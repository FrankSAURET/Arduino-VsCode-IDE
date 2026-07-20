// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as Logger from "../logger/logger";

export const DEFAULT_ARDUINO_THEME = "Arduino light";

const ARDUINO_THEME_EXTENSION_ID = "electropol-fr.coloredtheme";
const SUPPORTED_ARDUINO_THEMES = [
    DEFAULT_ARDUINO_THEME,
    "Arduino dark",
];

// Thèmes de l'ancien pack `oscarewenstudent.arduino-themes-vsc`, conservés comme
// alias : ils restent utilisables tant que ce pack est installé, mais pointent
// vers l'équivalent Colored Theme dès que celui-ci est disponible.
const LEGACY_THEME_ALIASES: { [legacyName: string]: string } = {
    "Arduino": DEFAULT_ARDUINO_THEME,
    "Arduino Light": DEFAULT_ARDUINO_THEME,
    "Arduino Dark": "Arduino dark",
};
const promptedThemes = new Set<string>();

interface IThemeContribution {
    label?: string;
    id?: string;
}

export interface IThemeExtensionLike {
    id: string;
    packageJSON?: {
        contributes?: {
            themes?: IThemeContribution[];
        };
    };
}

export function getRecommendedThemeExtensionId(themeName: string): string | undefined {
    if (SUPPORTED_ARDUINO_THEMES.indexOf(themeName) >= 0) {
        return ARDUINO_THEME_EXTENSION_ID;
    }

    // Un thème de l'ancien pack absent du système : on propose Colored Theme,
    // qui fournit l'équivalent.
    return LEGACY_THEME_ALIASES.hasOwnProperty(themeName) ? ARDUINO_THEME_EXTENSION_ID : undefined;
}

/**
 * Résout le thème réellement applicable :
 * - thème Colored Theme disponible -> on le garde ;
 * - ancien libellé + Colored Theme installé -> on bascule vers l'équivalent Colored Theme ;
 * - ancien libellé + seul l'ancien pack installé -> on conserve l'ancien libellé, il fonctionne ;
 * - rien d'installé -> on renvoie l'équivalent Colored Theme, pour que l'installation proposée soit la bonne.
 */
export function resolveArduinoTheme(themeName: string, extensions: ReadonlyArray<IThemeExtensionLike>): string {
    const alias = LEGACY_THEME_ALIASES[themeName];
    if (!alias) {
        return themeName;
    }

    if (findThemeExtensionId(alias, extensions)) {
        return alias;
    }

    return findThemeExtensionId(themeName, extensions) ? themeName : alias;
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
    const globalValue = inspection?.globalValue;
    if (globalValue && (SUPPORTED_ARDUINO_THEMES.includes(globalValue) || LEGACY_THEME_ALIASES.hasOwnProperty(globalValue))) {
        await workbenchConfig.update("colorTheme", undefined, vscode.ConfigurationTarget.Global);
    }
}

export async function applyArduinoTheme(context: vscode.ExtensionContext, requestedTheme: string): Promise<void> {
    await removeArduinoThemeFromGlobal();

    if (!requestedTheme) {
        return;
    }

    const extensions = <ReadonlyArray<IThemeExtensionLike>>vscode.extensions.all;
    const themeName = resolveArduinoTheme(requestedTheme, extensions);

    if (!findThemeExtensionId(themeName, extensions)) {
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

    const installAction = vscode.l10n.t("Install Colored Theme");
    const selection = await vscode.window.showInformationMessage(
        vscode.l10n.t("The theme \"{0}\" is not installed. Install the Colored Theme extension now?", themeName),
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
        void vscode.window.showWarningMessage(vscode.l10n.t("Unable to install the Colored Theme extension automatically."));
    }
}
