// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as Logger from "../logger/logger";

export const KABLIX_EXTENSION_ID = "electropol-fr.kablix";

const KABLIX_STATE_KEY = "arduino.kablixRecommendation";

export interface IKablixRecommendationState {
    // Version de l'extension lors du dernier affichage : permet de reproposer
    // Kablix après chaque mise à jour, sans harceler à chaque activation.
    lastShownVersion?: string;
    // L'utilisateur a explicitement demandé à ne plus voir la recommandation.
    dismissedForever?: boolean;
}

/**
 * Recommandation affichée au premier lancement puis à chaque nouvelle version,
 * sauf si Kablix est déjà installée ou si l'utilisateur l'a refusée définitivement.
 */
export function shouldRecommendKablix(
    isInstalled: boolean,
    currentVersion: string,
    state: IKablixRecommendationState | undefined,
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

export async function recommendKablix(context: vscode.ExtensionContext): Promise<void> {
    const currentVersion = <string>context.extension?.packageJSON?.version || "";
    const state = context.globalState.get<IKablixRecommendationState>(KABLIX_STATE_KEY);
    const isInstalled = !!vscode.extensions.getExtension(KABLIX_EXTENSION_ID);

    if (!shouldRecommendKablix(isInstalled, currentVersion, state)) {
        return;
    }

    // Marqué comme affiché avant l'attente de la réponse : une fenêtre fermée
    // sans répondre ne doit pas rejouer la notification à l'activation suivante.
    await context.globalState.update(KABLIX_STATE_KEY, { ...state, lastShownVersion: currentVersion });

    const installAction = vscode.l10n.t("Install Kablix");
    const neverAction = vscode.l10n.t("Don't show again");
    const selection = await vscode.window.showInformationMessage(
        vscode.l10n.t("Arduino VsCode IDE recommends \"Kablix\": an Arduino and Pico Pi simulator (in C/C++ and MicroPython)."),
        installAction,
        vscode.l10n.t("Later"),
        neverAction,
    );

    if (selection === neverAction) {
        await context.globalState.update(KABLIX_STATE_KEY, { lastShownVersion: currentVersion, dismissedForever: true });
        return;
    }

    if (selection !== installAction) {
        return;
    }

    try {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", KABLIX_EXTENSION_ID);
    } catch (error) {
        Logger.traceError("installKablixError", error, { extensionId: KABLIX_EXTENSION_ID });
        void vscode.window.showWarningMessage(vscode.l10n.t("Unable to install Kablix automatically."));
        await vscode.commands.executeCommand(
            "workbench.extensions.search",
            `@id:${KABLIX_EXTENSION_ID}`,
        );
    }
}
