// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as Logger from "../logger/logger";
import { isCompilerParserEnabled } from "./intellisense";

export const KABLIX_EXTENSION_ID = "electropol-fr.kablix";
export const CPPTOOLS_EXTENSION_ID = "ms-vscode.cpptools";

const KABLIX_STATE_KEY = "arduino.kablixRecommendation";
const CPPTOOLS_STATE_KEY = "arduino.cppToolsRecommendation";

export interface IRecommendationState {
    // Version de l'extension lors du dernier affichage : permet de reproposer
    // l'extension après chaque mise à jour, sans harceler à chaque activation.
    lastShownVersion?: string;
    // L'utilisateur a explicitement demandé à ne plus voir la recommandation.
    dismissedForever?: boolean;
}

// Conservé pour compatibilité avec l'ancien nom du type.
export type IKablixRecommendationState = IRecommendationState;

/**
 * Recommandation affichée au premier lancement puis à chaque nouvelle version,
 * sauf si l'extension est déjà installée ou si l'utilisateur l'a refusée
 * définitivement.
 */
export function shouldRecommend(
    isInstalled: boolean,
    currentVersion: string,
    state: IRecommendationState | undefined,
): boolean {
    if (isInstalled || !currentVersion) {
        return false;
    }

    const { lastShownVersion, dismissedForever } = state || {};
    if (dismissedForever) {
        return false;
    }

    return lastShownVersion !== currentVersion;
}

export const shouldRecommendKablix = shouldRecommend;

/**
 * Corps commun des recommandations : mémorisation de l'affichage, boutons
 * installer / plus tard / ne plus proposer, repli sur la recherche du
 * Marketplace si l'installation automatique échoue (extension absente du
 * registre courant, par exemple sur Open VSX).
 */
async function promptRecommendation(
    context: vscode.ExtensionContext,
    stateKey: string,
    extensionId: string,
    message: string,
    installAction: string,
    installErrorMessage: string,
    telemetryKey: string,
): Promise<void> {
    const state = context.globalState.get<IRecommendationState>(stateKey);
    const currentVersion = <string>context.extension?.packageJSON?.version || "";

    // Marqué comme affiché avant l'attente de la réponse : une fenêtre fermée
    // sans répondre ne doit pas rejouer la notification à l'activation suivante.
    await context.globalState.update(stateKey, { ...state, lastShownVersion: currentVersion });

    const neverAction = vscode.l10n.t("Don't show again");
    const selection = await vscode.window.showInformationMessage(
        message,
        installAction,
        vscode.l10n.t("Later"),
        neverAction,
    );

    if (selection === neverAction) {
        await context.globalState.update(stateKey, { lastShownVersion: currentVersion, dismissedForever: true });
        return;
    }

    if (selection !== installAction) {
        return;
    }

    try {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId);
    } catch (error) {
        Logger.traceError(telemetryKey, error, { extensionId });
        void vscode.window.showWarningMessage(installErrorMessage);
        await vscode.commands.executeCommand(
            "workbench.extensions.search",
            `@id:${extensionId}`,
        );
    }
}

export async function recommendKablix(context: vscode.ExtensionContext): Promise<void> {
    const currentVersion = <string>context.extension?.packageJSON?.version || "";
    const state = context.globalState.get<IRecommendationState>(KABLIX_STATE_KEY);
    const isInstalled = !!vscode.extensions.getExtension(KABLIX_EXTENSION_ID);

    if (!shouldRecommend(isInstalled, currentVersion, state)) {
        return;
    }

    await promptRecommendation(
        context,
        KABLIX_STATE_KEY,
        KABLIX_EXTENSION_ID,
        vscode.l10n.t("Arduino VsCode IDE recommends \"Kablix\": an Arduino and Pico Pi simulator (in C/C++ and MicroPython)."),
        vscode.l10n.t("Install Kablix"),
        vscode.l10n.t("Unable to install Kablix automatically."),
        "installKablixError",
    );
}

/**
 * C/C++ (ms-vscode.cpptools) n'est plus une dépendance dure : l'extension
 * fonctionne sans (compilation, téléversement, moniteur série). Il ne sert
 * qu'à exploiter le `c_cpp_properties.json` généré, donc on ne le propose que
 * si la génération IntelliSense est active.
 */
export async function recommendCppTools(context: vscode.ExtensionContext): Promise<void> {
    const currentVersion = <string>context.extension?.packageJSON?.version || "";
    const state = context.globalState.get<IRecommendationState>(CPPTOOLS_STATE_KEY);
    const isInstalled = !!vscode.extensions.getExtension(CPPTOOLS_EXTENSION_ID);

    if (!shouldRecommend(isInstalled, currentVersion, state) || !isCompilerParserEnabled()) {
        return;
    }

    await promptRecommendation(
        context,
        CPPTOOLS_STATE_KEY,
        CPPTOOLS_EXTENSION_ID,
        vscode.l10n.t("Install the \"C/C++\" extension to get IntelliSense (completion, navigation, error checking) in your sketches. Everything else works without it."),
        vscode.l10n.t("Install C/C++"),
        vscode.l10n.t("Unable to install the \"C/C++\" extension automatically."),
        "installCppToolsError",
    );
}
