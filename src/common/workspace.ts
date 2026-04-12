// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ARDUINO_CONFIG_FILE } from "./constants";

export class ArduinoWorkspace {
    /**
     * Issue #71: Returns the workspace root path based on the active editor's folder.
     * In multi-root workspaces, each folder can have its own arduino.json.
     * Falls back to the first folder with arduino.json, then the first workspace folder.
     */
    static get rootPath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }

        // Try to resolve based on the active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
            if (activeFolder) {
                return activeFolder.uri.fsPath;
            }
        }

        // Fall back to finding a folder with arduino.json
        for (const workspaceFolder of workspaceFolders) {
            const workspaceFolderPath = workspaceFolder.uri.fsPath;
            const arduinoConfigPath = path.join(workspaceFolderPath, ARDUINO_CONFIG_FILE);
            if (fs.existsSync(arduinoConfigPath)) {
                return workspaceFolderPath;
            }
        }

        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Returns the workspace folder path for a given file URI.
     * Useful for multi-root workspace operations.
     */
    static getWorkspaceFolderForFile(fileUri: vscode.Uri): string | undefined {
        const folder = vscode.workspace.getWorkspaceFolder(fileUri);
        return folder ? folder.uri.fsPath : undefined;
    }
}
