// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

function isCompact(): boolean {
    try {
        const config = vscode.workspace.getConfiguration();
        return config.get<string>("arduino.outputVerbosity") === "compact";
    } catch {
        return false;
    }
}

export const arduinoChannel = {
    channel: vscode.window.createOutputChannel("Arduino"),

    start(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Starting]")} ${message}`);
    },

    end(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Done]")} ${message}`);
    },

    warning(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Warning]")} ${message}`);
    },

    error(message: string) {
        this.channel.appendLine(`${vscode.l10n.t("[Error]")} ${message}`);
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
