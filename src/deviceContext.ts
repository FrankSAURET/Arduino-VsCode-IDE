// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as constants from "./common/constants";
import * as util from "./common/util";

import { ARDUINO_CONFIG_FILE } from "./common/constants";
import { ArduinoWorkspace } from "./common/workspace";
import { DeviceSettings } from "./deviceSettings"

/**
 * Interface that represents the arduino context information.
 * @interface
 */
export interface IDeviceContext {
    /**
     * COM Port connect to the device
     * @property {string}
     */
    port: string;

    /**
     * Current selected Arduino board alias.
     * @property {string}
     */
    board: string;

    /**
     * Arduino main sketch file
     * @property {string}
     */
    sketch: string;

    /**
     * Arduino build output path
     */

    output: string;
    /**
     * Arduino debugger
     */

    debugger_: string;

    /**
     * Current selected programmer.
     * @property {string}
     */
    programmer: string;

    /**
     * Arduino custom board configuration
     * @property {string}
     */
    configuration: string;

    /**
     * IntelliSense configuration auto-generation project override.
     */
    intelliSenseGen: string;

    initialize(): Thenable<string | undefined>;
    openProjectFolder(): Thenable<string | undefined>;
}

export class DeviceContext implements IDeviceContext, vscode.Disposable {

    public static getInstance(): DeviceContext {
        return DeviceContext._deviceContext;
    }

    private static _deviceContext: DeviceContext = new DeviceContext();

    private _settings = new DeviceSettings();
    private _extensionPath: string;

    private _watcher: vscode.FileSystemWatcher;

    private _vscodeWatcher: vscode.FileSystemWatcher;

    private _sketchStatusBar: vscode.StatusBarItem;

    private _prebuild: string;

    private _programmer: string;

    private _suppressSaveContext: boolean = false;

    /**
     * @constructor
     */
    private constructor() {
        if (vscode.workspace && ArduinoWorkspace.rootPath) {
            this._watcher = vscode.workspace.createFileSystemWatcher(path.join(ArduinoWorkspace.rootPath, ARDUINO_CONFIG_FILE));
            // We only care about the deletion arduino.json in the .vscode folder:
            this._vscodeWatcher = vscode.workspace.createFileSystemWatcher(path.join(ArduinoWorkspace.rootPath, ".vscode"), true, true, false);

            this._watcher.onDidCreate(() => this.loadContext());
            this._watcher.onDidChange(() => this.loadContext());
            this._watcher.onDidDelete(() => this.loadContext());
            this._vscodeWatcher.onDidDelete(() => this.loadContext());
            this._sketchStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.SKETCH);
            this._sketchStatusBar.command = "arduino.selectSketch";
            this._sketchStatusBar.tooltip = vscode.l10n.t("Sketch File");
        }
    }

    public dispose() {
        if (this._watcher) {
            this._watcher.dispose();
        }
        if (this._vscodeWatcher) {
            this._vscodeWatcher.dispose();
        }
    }

    public get extensionPath(): string {
        return this._extensionPath;
    }

    public set extensionPath(value: string) {
        this._extensionPath = value;
    }

    public loadContext(): Thenable<object> {
        return vscode.workspace.findFiles(ARDUINO_CONFIG_FILE, null, 1)
            .then((files) => {
                if (files && files.length > 0) {
                    this._settings.load(files[0].fsPath);
                    // on invalid configuration we continue with current settings
                } else {
                    // No configuration file found, starting over with defaults
                    this._settings.reset();
                }
                return this;
            }, (reason) => {
                // Workaround for change in API.
                // vscode.workspace.findFiles() for some reason now throws an error ehn path does not exist
                // vscode.window.showErrorMessage(reason.toString());
                // Logger.notifyUserError("arduinoFileUnhandleError", new Error(reason.toString()));

                 // Workaround for change in API, populate required props for arduino.json
                this._settings.reset();
                return this;
            });
    }

    public showStatusBar() {
        if (!this._settings.sketch.value) {
            return false;
        }
        this._sketchStatusBar.text = this._settings.sketch.value;
        this._sketchStatusBar.show();
    }

    public get onChangePort() { return this._settings.port.emitter.event }
    public get onChangeBoard() { return this._settings.board.emitter.event }
    public get onChangeSketch() { return this._settings.sketch.emitter.event }
    public get onChangeOutput() { return this._settings.output.emitter.event }
    public get onChangeDebugger() { return this._settings.debugger.emitter.event }
    public get onChangeISAutoGen() { return this._settings.intelliSenseGen.emitter.event }
    public get onChangeConfiguration() { return this._settings.configuration.emitter.event }
    public get onChangePrebuild() { return this._settings.prebuild.emitter.event }
    public get onChangePostbuild() { return this._settings.postbuild.emitter.event }
    public get onChangeProgrammer() { return this._settings.programmer.emitter.event }

    public get port() {
        return this._settings.port.value;
    }

    public set port(value: string) {
        this._settings.port.value = value;
        this.saveContext();
    }

    public get board() {
        return this._settings.board.value;
    }

    public set board(value: string) {
        this._settings.board.value = value;
        this.saveContext();
    }

    public get sketch() {
        return this._settings.sketch.value;
    }

    public set sketch(value: string) {
        this._settings.sketch.value = value;
        this.saveContext();
    }

    public get prebuild() {
        return this._settings.prebuild.value;
    }

    public get postbuild() {
        return this._settings.postbuild.value;
    }

    public get output() {
        return this._settings.output.value;
    }

    public set output(value: string) {
        this._settings.output.value = value;
        this.saveContext();
    }

    public get debugger_() {
        return this._settings.debugger.value;
    }

    public set debugger_(value: string) {
        this._settings.debugger.value = value;
        this.saveContext();
    }

    public get intelliSenseGen() {
        return this._settings.intelliSenseGen.value;
    }

    public set intelliSenseGen(value: string) {
        this._settings.intelliSenseGen.value = value;
        this.saveContext();
    }

    public get configuration() {
        return this._settings.configuration.value;
    }

    public set configuration(value: string) {
        this._settings.configuration.value = value;
        this.saveContext();
    }

    public get programmer() {
        return this._settings.programmer.value;
    }

    public set programmer(value: string) {
        this._settings.programmer.value = value;
        this.saveContext();
    }

    public get suppressSaveContext() {
        return this._suppressSaveContext;
    }

    public set suppressSaveContext(value: boolean) {
        this._suppressSaveContext = value;
    }

    public get buildPreferences() {
        return this._settings.buildPreferences.value;
    }

    public async initialize(): Promise<string | undefined> {
        const baseFolder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Select parent folder"),
            title: vscode.l10n.t("Select parent folder for the new Arduino project"),
        });
        if (!baseFolder || baseFolder.length === 0) {
            return undefined;
        }

        const projectName = await vscode.window.showInputBox({
            value: "MyArduinoProject",
            prompt: vscode.l10n.t("Enter the project name"),
            placeHolder: vscode.l10n.t("Project name"),
            validateInput: (value) => {
                const trimmed = (value || "").trim();
                if (!trimmed) {
                    return vscode.l10n.t("Project name is required.");
                }
                if (!/^[\w-]+$/.test(trimmed)) {
                    return vscode.l10n.t("Use only letters, numbers, underscores, or hyphens.");
                }
                const projectFolder = path.join(baseFolder[0].fsPath, trimmed);
                if (util.directoryExistsSync(projectFolder) || util.fileExistsSync(projectFolder)) {
                    return vscode.l10n.t("A file or folder with this name already exists.");
                }
                return null;
            },
        });
        if (!projectName) {
            return undefined;
        }

        return this.createProjectScaffold(baseFolder[0].fsPath, projectName.trim());
    }

    public async openProjectFolder(): Promise<string | undefined> {
        const selectedFolder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Open project"),
            title: vscode.l10n.t("Select an Arduino project folder"),
        });
        if (!selectedFolder || selectedFolder.length === 0) {
            return undefined;
        }
        return selectedFolder[0].fsPath;
    }

    /**
     * Note: We're using the class' setter for the sketch (i.e. this.sketch = ...)
     * to make sure that any changes are synched to the configuration file.
     */
    public async resolveMainSketch() {
        await vscode.workspace.findFiles("**/*.ino", null)
            .then(async (fileUris) => {
                // Also look for .cpp sketches when no .ino is found
                if (fileUris.length === 0) {
                    const cppUris = await vscode.workspace.findFiles("**/*.cpp", null);
                    if (cppUris.length > 0) {
                        fileUris = cppUris;
                    }
                }
                if (fileUris.length === 0) {
                    let newSketchFileName = await vscode.window.showInputBox({
                        value: "sketch.ino",
                        prompt: vscode.l10n.t("No sketch (*.ino) found in workspace, please provide a name"),
                        placeHolder: vscode.l10n.t("Sketch file name (*.ino or *.cpp)"),
                        validateInput: (value) => {
                            if (value && /^[\w-]+\.(?:ino|cpp)$/.test(value.trim())) {
                                return null;
                            } else {
                                return vscode.l10n.t("Invalid sketch file name. Should be *.ino/*.cpp");
                            }
                        },
                    });
                    newSketchFileName = (newSketchFileName && newSketchFileName.trim()) || "";
                    if (newSketchFileName) {
                        const snippets = fs.readFileSync(path.join(this.extensionPath, "snippets", "sample.ino"));
                        fs.writeFileSync(path.join(ArduinoWorkspace.rootPath, newSketchFileName), snippets);
                        this.sketch = newSketchFileName;
                        // Set a build directory in new configurations to avoid warnings about slow builds.
                        this.output = "build";
                        // Open the new sketch file.
                        const textDocument = await vscode.workspace.openTextDocument(path.join(ArduinoWorkspace.rootPath, newSketchFileName));
                        vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One, true);
                    } else {
                        this.sketch = undefined;
                    }
                } else if (fileUris.length === 1) {
                    this.sketch = path.relative(ArduinoWorkspace.rootPath, fileUris[0].fsPath);
                } else if (fileUris.length > 1) {
                    const chosen = await vscode.window.showQuickPick(<vscode.QuickPickItem[]>fileUris.map((fileUri): vscode.QuickPickItem => {
                        return <vscode.QuickPickItem>{
                            label: path.relative(ArduinoWorkspace.rootPath, fileUri.fsPath),
                            description: fileUri.fsPath,
                        };
                    }), { placeHolder: vscode.l10n.t("Select the main sketch file") });
                    if (chosen && chosen.label) {
                        this.sketch = chosen.label;
                    }
                }
            });
        return this.sketch;
    }

    private saveContext() {
        if (!ArduinoWorkspace.rootPath) {
            return;
        }
        const deviceConfigFile = path.join(ArduinoWorkspace.rootPath, ARDUINO_CONFIG_FILE);
        this._settings.save(deviceConfigFile);
    }

    private async createProjectScaffold(parentFolder: string, projectName: string): Promise<string> {
        const projectFolder = path.join(parentFolder, projectName);
        const sketchFileName = `${projectName}.ino`;
        const sketchFilePath = path.join(projectFolder, sketchFileName);
        const arduinoConfigPath = path.join(projectFolder, ARDUINO_CONFIG_FILE);

        util.mkdirRecursivelySync(projectFolder);
        const snippets = fs.readFileSync(path.join(this.extensionPath, "snippets", "sample.ino"));
        fs.writeFileSync(sketchFilePath, snippets);
        util.mkdirRecursivelySync(path.dirname(arduinoConfigPath));
        fs.writeFileSync(arduinoConfigPath, JSON.stringify({
            sketch: sketchFileName,
            output: "build",
        }, undefined, 4));

        return projectFolder;
    }
}
