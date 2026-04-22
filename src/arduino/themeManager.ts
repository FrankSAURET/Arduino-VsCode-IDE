// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as Logger from "../logger/logger";

export const DEFAULT_ARDUINO_THEME = "Arduino Light";

const ARDUINO_THEME_EXTENSION_ID = "oscarewenstudent.arduino-themes-vsc";
const SUPPORTED_ARDUINO_THEMES = [
    "Arduino",
    DEFAULT_ARDUINO_THEME,
    "Arduino Dark",
];
const promptedThemes = new Set<string>();

interface IThemeContribution {
    label?: string;
    id?: string;
}

interface IThemeExtensionLike {
    id: string;
    packageJSON?: {
        contributes?: {
            themes?: IThemeContribution[];
        };
    };
}

export function getRecommendedThemeExtensionId(themeName: string): string | undefined {
    return SUPPORTED_ARDUINO_THEMES.indexOf(themeName) >= 0 ? ARDUINO_THEME_EXTENSION_ID : undefined;
}

export function findThemeExtensionId(themeName: string, extensions: ReadonlyArray<IThemeExtensionLike>): string | undefined {
    for (const extension of extensions) {
        const packageJSON = extension.packageJSON || {};
        const contributes = packageJSON.contributes || {};
        const themes = contributes.themes || [];

        for (const theme of themes) {
            if (theme && (theme.label === themeName || theme.id === themeName)) {
                return extension.id;
            }
        }
    }

    return undefined;
}

export function canStoreArduinoThemeLocally(hasWorkspaceFile: boolean, workspaceFolderCount: number): boolean {
    return hasWorkspaceFile || workspaceFolderCount > 0;
}

async function removeArduinoThemeFromGlobal(): Promise<void> {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const inspection = workbenchConfig.inspect<string>("colorTheme");
    if (inspection?.globalValue && SUPPORTED_ARDUINO_THEMES.includes(inspection.globalValue)) {
        await workbenchConfig.update("colorTheme", undefined, vscode.ConfigurationTarget.Global);
    }
}

export async function applyArduinoTheme(context: vscode.ExtensionContext, themeName: string): Promise<void> {
    await removeArduinoThemeFromGlobal();

    if (!themeName) {
        return;
    }

    if (!findThemeExtensionId(themeName, <ReadonlyArray<IThemeExtensionLike>>vscode.extensions.all)) {
        await promptThemeInstallation(context, themeName);
        return;
    }

    if (!canStoreArduinoThemeLocally(!!vscode.workspace.workspaceFile, vscode.workspace.workspaceFolders?.length || 0)) {
        Logger.info("skipApplyArduinoThemeWithoutWorkspace", { themeName });
        return;
    }

    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const inspection = workbenchConfig.inspect<string>("colorTheme");
    if (inspection?.workspaceValue === themeName || inspection?.workspaceFolderValue === themeName) {
        return;
    }

    await workbenchConfig.update("colorTheme", themeName, vscode.ConfigurationTarget.Workspace);
}

async function promptThemeInstallation(context: vscode.ExtensionContext, themeName: string): Promise<void> {
    const extensionId = getRecommendedThemeExtensionId(themeName);
    if (!extensionId) {
        return;
    }

    const promptKey = `${extensionId}:${themeName}`;
    if (promptedThemes.has(promptKey)) {
        return;
    }
    promptedThemes.add(promptKey);

    const installAction = vscode.l10n.t("Install Arduino Theme Pack");
    const selection = await vscode.window.showInformationMessage(
        vscode.l10n.t("The theme \"{0}\" is not installed. Install the Arduino Theme Pack now?", themeName),
        installAction,
        vscode.l10n.t("Not now"),
    );

    if (selection !== installAction) {
        return;
    }

    try {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId);
        await applyArduinoTheme(context, themeName);
    } catch (error) {
        Logger.traceError("installArduinoThemeError", error, { extensionId, themeName });
        void vscode.window.showWarningMessage(vscode.l10n.t("Unable to install the Arduino theme pack automatically."));
    }
}
