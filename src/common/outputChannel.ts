// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

// Marqueurs invisibles ajoutes en fin de ligne pour que la coloration
// syntaxique reconnaisse la categorie du message sans dependre de la langue
// de traduction du mot entre crochets.
const MARK_START = "\u200B";      // espace sans chasse
const MARK_DONE = "\u200C";       // antiliaison sans chasse
const MARK_WARNING = "\u200D";    // liaison sans chasse
const MARK_ERROR = "\u2060";      // mot insecable

function isCompact(): boolean {
    try {
        const config = vscode.workspace.getConfiguration();
        return config.get<string>("arduino.outputVerbosity") === "compact";
    } catch {
        return false;
    }
}

export const arduinoChannel = {
    // Le second argument associe le canal au langage "arduino-output", ce qui
    // active la coloration definie dans syntaxes/arduino.output.tmLanguage.
    // Le transtypage est necessaire : les typages @types/vscode figes a la 1.56
    // ne declarent pas cette surcharge, disponible depuis la 1.57.
    channel: (vscode.window.createOutputChannel as (name: string, languageId?: string) => vscode.OutputChannel)("Arduino", "arduino-output"),

    start(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Starting]")} ${message}${MARK_START}`);
    },

    end(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Done]")} ${message}${MARK_DONE}`);
    },

    warning(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Warning]")} ${message}${MARK_WARNING}`);
    },

    error(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Error]")} ${message}${MARK_ERROR}`);
    },

    info(message: string) {
        if (isCompact()) {
            return;
        }
        this.channel.appendLine(message);
    },

    show() {
        this.channel.show();
    },

    hide() {
        this.channel.hide();
    },

    clear() {
        this.channel.clear();
    },
};
