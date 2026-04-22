// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const impor = require("impor")(__dirname);

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as constants from "./common/constants";
const arduinoContentProviderModule =
    impor("./arduino/arduinoContentProvider") as typeof import ("./arduino/arduinoContentProvider");
import { IBoard } from "./arduino/package";
import { VscodeSettings } from "./arduino/vscodeSettings";
const arduinoActivatorModule = impor("./arduinoActivator") as typeof import ("./arduinoActivator");
const arduinoContextModule = impor("./arduinoContext") as typeof import ("./arduinoContext");
const quickAccessProviderModule = impor("./arduino/projectLauncherProvider") as typeof import ("./arduino/projectLauncherProvider");
const arduinoHomePanelModule = impor("./arduino/arduinoHomePanel") as typeof import ("./arduino/arduinoHomePanel");
import {
    ARDUINO_CONFIG_FILE, ARDUINO_MANAGER_PROTOCOL, ARDUINO_MODE, BOARD_CONFIG_URI, BOARD_MANAGER_URI, EXAMPLES_URI,
    LIBRARY_MANAGER_URI,
} from "./common/constants";
import { validateArduinoPath } from "./common/platform";
import * as util from "./common/util";
import { ArduinoWorkspace } from "./common/workspace";
const arduinoDebugConfigurationProviderModule = impor("./debug/configurationProvider") as typeof import ("./debug/configurationProvider");
import { DeviceContext } from "./deviceContext";
const completionProviderModule = impor("./langService/completionProvider") as typeof import ("./langService/completionProvider");
import { BuildMode } from "./arduino/arduino";
import { checkForCliUpdate } from "./arduino/cliDownloader";
import { applyArduinoTheme } from "./arduino/themeManager";
import { listSerialPorts } from "./common/portList";
import * as Logger from "./logger/logger";
const usbDetectorModule = impor("./serialmonitor/usbDetector") as typeof import ("./serialmonitor/usbDetector");

const TELEPLOT_EXTENSION_ID = "alexnesnes.teleplot";
const TELEPLOT_START_COMMAND = "teleplot.start";

export async function activate(context: vscode.ExtensionContext) {
    Logger.configure(context);
    const pendingBoardSelectionKey = "arduino.pendingBoardSelectionPath";
    const vscodeSettings = VscodeSettings.getInstance();

    const getErrorMessage = (error: any): string => {
        if (error instanceof Error && error.message) {
            return error.message;
        }

        return `${error}`;
    };
    const isTeleplotReady = async (): Promise<boolean> => {
        const teleplotExtension = vscode.extensions.getExtension(TELEPLOT_EXTENSION_ID);
        if (!teleplotExtension) {
            return false;
        }
        if (!teleplotExtension.isActive) {
            try {
                await teleplotExtension.activate();
            } catch {
            }
        }
        const commands = await vscode.commands.getCommands(true);
        return commands.includes(TELEPLOT_START_COMMAND);
    };
    const ensureTeleplotReady = async (): Promise<boolean> => {
        if (await isTeleplotReady()) {
            return true;
        }

        const installButton = vscode.l10n.t("Install Teleplot");
        const installChoice = await vscode.window.showInformationMessage(
            vscode.l10n.t("Teleplot is required to use the serial tracer. Do you want to install it now?"),
            { modal: true },
            installButton,
        );
        if (installChoice !== installButton) {
            return false;
        }

        try {
            await vscode.commands.executeCommand("workbench.extensions.installExtension", TELEPLOT_EXTENSION_ID);
        } catch (error) {
            vscode.window.showErrorMessage(vscode.l10n.t("Teleplot installation failed: {0}", getErrorMessage(error)));
            return false;
        }

        if (await isTeleplotReady()) {
            return true;
        }

        const reloadButton = vscode.l10n.t("Reload Window");
        const reloadChoice = await vscode.window.showInformationMessage(
            vscode.l10n.t("Teleplot was installed. Reload VS Code to finish activating it."),
            reloadButton,
        );
        if (reloadChoice === reloadButton) {
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }

        return false;
    };
    const openSerialTracer = async () => {
        if (!await ensureTeleplotReady()) {
            return;
        }
        try {
            const mode = vscodeSettings.teleplotOpenMode;
            await vscode.commands.executeCommand(TELEPLOT_START_COMMAND);
            if (mode === "splitRight") {
                await vscode.commands.executeCommand("workbench.action.moveEditorToRightGroup");
            } else if (mode === "newPanel") {
                await vscode.commands.executeCommand("workbench.action.moveEditorToBelowGroup");
            }
            // "newTab" = comportement par défaut de Teleplot, pas de repositionnement
        } catch (error) {
            vscode.window.showErrorMessage(vscode.l10n.t("Unable to open Teleplot: {0}", getErrorMessage(error)));
        }
    };
    const applyConfiguredArduinoTheme = async () => {
        await applyArduinoTheme(context, vscodeSettings.arduinoTheme);
    };

    // Show a warning message if the working file is not under the workspace folder.
    // People should know the extension might not work appropriately, they should look for the doc to get started.
    const openEditor = vscode.window.activeTextEditor;
    if (openEditor && openEditor.document.fileName.endsWith(".ino")) {
        const workingFile = path.normalize(openEditor.document.fileName);
        const workspaceFolder = (vscode.workspace && ArduinoWorkspace.rootPath) || "";
        if (!workspaceFolder || workingFile.indexOf(path.normalize(workspaceFolder)) < 0) {
            vscode.window.showWarningMessage(vscode.l10n.t("The open file \"{0}\" is not inside the workspace folder, the arduino extension might not work properly.", workingFile));
        }
        await applyConfiguredArduinoTheme();
    }
    const deviceContext = DeviceContext.getInstance();
    deviceContext.extensionPath = context.extensionPath;
    context.subscriptions.push(deviceContext);

    // Pass extension path to the activator for CLI auto-download
    arduinoActivatorModule.default.setExtensionPath(context.extensionPath);

    const quickAccessTreeView = vscode.window.createTreeView(
        "arduinoProjectWelcome",
        { treeDataProvider: new quickAccessProviderModule.QuickAccessProvider() },
    );
    context.subscriptions.push(quickAccessTreeView);

    const runPendingBoardSelection = async () => {
        const pendingBoardSelectionPath = context.globalState.get<string>(pendingBoardSelectionKey);
        if (!pendingBoardSelectionPath || !ArduinoWorkspace.rootPath) {
            return;
        }
        if (path.resolve(pendingBoardSelectionPath) !== path.resolve(ArduinoWorkspace.rootPath)) {
            return;
        }
        if (!arduinoContextModule.default.initialized) {
            await arduinoActivatorModule.default.activate();
        }
        if (!deviceContext.board) {
            await arduinoContextModule.default.boardManager.changeBoardType();
        }
        await context.globalState.update(pendingBoardSelectionKey, undefined);
    };

    const commandExecution = async (command: string, commandBody: (...args: any[]) => any, args: any, getUserData?: () => any) => {
        try {
            let result = commandBody(...args);
            if (result) {
                result = await Promise.resolve(result);
            }
        } catch (error) {
            Logger.traceError("executeCommandError", error, { command });
        }
    };
    const registerArduinoCommand = (command: string, commandBody: (...args: any[]) => any, getUserData?: () => any): number => {
        return context.subscriptions.push(vscode.commands.registerCommand(command, async (...args: any[]) => {
            if (!arduinoContextModule.default.initialized) {
                await arduinoActivatorModule.default.activate();
            }

            const arduinoPath = arduinoContextModule.default.arduinoApp.settings.arduinoPath;
            const commandPath = arduinoContextModule.default.arduinoApp.settings.commandPath;
            // Pop up vscode User Settings page when cannot resolve arduino path.
            if (!arduinoPath || !validateArduinoPath(arduinoPath)) {
                Logger.notifyUserError("InvalidArduinoPath", new Error(constants.messages.INVALID_ARDUINO_PATH));
                vscode.commands.executeCommand("workbench.action.openGlobalSettings");
            } else if (!commandPath || !util.fileExistsSync(commandPath)) {
                Logger.notifyUserError("InvalidCommandPath", new Error(constants.messages.INVALID_COMMAND_PATH + commandPath));
            } else {
                await commandExecution(command, commandBody, args, getUserData);
            }
        }));
    };

    const registerNonArduinoCommand = (command: string, commandBody: (...args: any[]) => any, getUserData?: () => any): number => {
        return context.subscriptions.push(vscode.commands.registerCommand(command, async (...args: any[]) => {
            await commandExecution(command, commandBody, args, getUserData);
        }));
    };

    context.subscriptions.push(vscode.commands.registerCommand("arduino.initialize", async () => {
        const projectFolder = await deviceContext.initialize();
        if (!projectFolder) {
            return;
        }
        // Open the project folder in the current window (this reloads the window)
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectFolder), false);
    }));
    context.subscriptions.push(vscode.commands.registerCommand("arduino.openProjectFolder", async () => {
        await applyConfiguredArduinoTheme();
        const folderPath = await deviceContext.openProjectFolder();
        if (!folderPath) {
            return;
        }
        // Open the project folder in the current window
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folderPath), false);
    }));

    registerArduinoCommand("arduino.verify", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Verifying..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.Verify);
            });
        }
    }, () => {
        return {
            board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                arduinoContextModule.default.boardManager.currentBoard.name,
        };
    });

    registerArduinoCommand("arduino.upload", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Uploading..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.Upload);
            });
        }
    }, () => {
        return { board: arduinoContextModule.default.boardManager.currentBoard.name };
    });

    registerArduinoCommand("arduino.cliUpload", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Using CLI to upload..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.CliUpload);
            });
        }
    }, () => {
        return { board: arduinoContextModule.default.boardManager.currentBoard.name };
    });

    registerArduinoCommand("arduino.selectSketch", async () => {
        const sketchFileName = deviceContext.sketch;

        // Include any ino, cpp, or c files under the workspace folder
        const includePattern = "**/*.{ino,cpp,c}";

        // The sketchbook folder may contain hardware & library folders, any sketches under these paths
        // should be excluded
        const sketchbookPath = arduinoContextModule.default.arduinoApp.settings.sketchbookPath;
        const excludePatterns = [
            path.relative(ArduinoWorkspace.rootPath, sketchbookPath + "/hardware/**"),
            path.relative(ArduinoWorkspace.rootPath, sketchbookPath + "/libraries/**")];

        // If an output path is specified, it should be excluded as well
        if (deviceContext.output) {
            const outputPath = path.relative(ArduinoWorkspace.rootPath,
                path.resolve(ArduinoWorkspace.rootPath, deviceContext.output));
            excludePatterns.push(`${outputPath}/**`);
        }
        const excludePattern = `{${excludePatterns.map((p) => p.replace("\\", "/")).join(",")}}`;

        const fileUris = await vscode.workspace.findFiles(includePattern, excludePattern);
        const newSketchFileName = await vscode.window.showQuickPick(fileUris.map((fileUri) =>
            ({
                label: path.relative(ArduinoWorkspace.rootPath, fileUri.fsPath),
                description: fileUri.fsPath,
            })),
            { placeHolder: sketchFileName, matchOnDescription: true });

        if (!newSketchFileName) {
            return;
        }

        deviceContext.sketch = newSketchFileName.label;
        deviceContext.showStatusBar();
    });

    registerArduinoCommand("arduino.uploadUsingProgrammer", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Uploading (programmer)..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.UploadProgrammer);
            });
        }
    }, () => {
        return { board: arduinoContextModule.default.boardManager.currentBoard.name };
    });

    registerArduinoCommand("arduino.cliUploadUsingProgrammer", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Using CLI to upload (programmer)..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.CliUploadProgrammer);
            });
        }
    }, () => {
        return { board: arduinoContextModule.default.boardManager.currentBoard.name };
    });

    registerArduinoCommand("arduino.rebuildIntelliSenseConfig", async () => {
        if (!arduinoContextModule.default.arduinoApp.building) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Arduino: Rebuilding IS Configuration..."),
            }, async () => {
                await arduinoContextModule.default.arduinoApp.build(BuildMode.Analyze);
            });
        }
    }, () => {
        return { board: arduinoContextModule.default.boardManager.currentBoard.name };
    });

    registerArduinoCommand("arduino.selectProgrammer", async () => {
        // Note: this guard does not prevent building while setting the
        // programmer. But when looking at the code of selectProgrammer
        // it seems not to be possible to trigger building while setting
        // the programmer. If the timed IntelliSense analysis is triggered
        // this is not a problem, since it doesn't use the programmer.
        if (!arduinoContextModule.default.arduinoApp.building) {
            try {
                await arduinoContextModule.default.arduinoApp.programmerManager.selectProgrammer();
            } catch (ex) {
            }
        }
    }, () => {
        return {
            board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                arduinoContextModule.default.boardManager.currentBoard.name,
        };
    });

    registerArduinoCommand("arduino.openExample", (path) => arduinoContextModule.default.arduinoApp.openExample(path));
    registerArduinoCommand("arduino.loadPackages", async () => await arduinoContextModule.default.boardManager.loadPackages(true));
    registerArduinoCommand("arduino.installBoard", async (packageName, arch, version: string = "") => {
        let installed = false;
        const installedBoards = arduinoContextModule.default.boardManager.installedBoards;
        installedBoards.forEach((board: IBoard, key: string) => {
            let _packageName: string;
            if (board.platform.package && board.platform.package.name) {
                _packageName = board.platform.package.name;
            } else {
                _packageName = board.platform.packageName;
            }

            if (packageName === _packageName &&
                arch === board.platform.architecture &&
                (!version || version === board.platform.installedVersion)) {
                installed = true;
            }
        });

        if (!installed) {
            await arduinoContextModule.default.boardManager.loadPackages(true);
            await arduinoContextModule.default.arduinoApp.installBoard(packageName, arch, version);
        }
        return;
    });

    context.subscriptions.push(vscode.commands.registerCommand("arduino.openSerialTracer", openSerialTracer));
    context.subscriptions.push(vscode.commands.registerCommand("arduino.openSerialMonitor", async () => {
        try {
            await vscode.commands.executeCommand("vscode-serial-monitor.monitor0.focus");
        } catch {
            vscode.window.showWarningMessage(
                vscode.l10n.t(
                    "The built-in VS Code serial monitor is not available. Install the \"Serial Monitor\" extension or use the built-in terminal.",
                ),
            );
        }
    }));
    registerNonArduinoCommand("arduino.selectSerialPort", async () => {
        const ports = await listSerialPorts();
        if (!ports.length) {
            vscode.window.showInformationMessage(vscode.l10n.t("No serial port is available."));
            return;
        }
        const chosen = await vscode.window.showQuickPick(
            ports.map((p) => ({ label: p.port, description: p.desc }))
                 .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
            { placeHolder: vscode.l10n.t("Select a serial port") },
        );
        if (chosen) {
            DeviceContext.getInstance().port = chosen.label;
        }
    });

    const completionProvider = new completionProviderModule.CompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(ARDUINO_MODE, completionProvider, "<", '"', "."));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider("arduino", new
        arduinoDebugConfigurationProviderModule.ArduinoDebugConfigurationProvider()));

    if (ArduinoWorkspace.rootPath && (
        util.fileExistsSync(path.join(ArduinoWorkspace.rootPath, ARDUINO_CONFIG_FILE))
        || (openEditor && openEditor.document.fileName.endsWith(".ino")))) {
        (async () => {
            await applyConfiguredArduinoTheme();
            if (!arduinoContextModule.default.initialized) {
                await arduinoActivatorModule.default.activate();
            }

            vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
            await runPendingBoardSelection();
        })();
    }
    vscode.window.onDidChangeActiveTextEditor(async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && ((path.basename(activeEditor.document.fileName) === "arduino.json"
            && path.basename(path.dirname(activeEditor.document.fileName)) === ".vscode")
            || activeEditor.document.fileName.endsWith(".ino")
        )) {
            await applyConfiguredArduinoTheme();
            if (!arduinoContextModule.default.initialized) {
                await arduinoActivatorModule.default.activate();
            }
            vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
        }
    });

    const allowPDEFiletype = vscodeSettings.allowPDEFiletype;

    if (allowPDEFiletype) {
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (/\.pde$/.test(document.uri.fsPath)) {
                const newFsName = document.uri.fsPath.replace(/\.pde$/, ".ino");
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                fs.renameSync(document.uri.fsPath, newFsName);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(newFsName));
            }
        });

        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (!editor) {
                return;
            }
            const document = editor.document;
            if (/\.pde$/.test(document.uri.fsPath)) {
                const newFsName = document.uri.fsPath.replace(/\.pde$/, ".ino");
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                fs.renameSync(document.uri.fsPath, newFsName);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(newFsName));
            }
        });
    }
    Logger.traceUserData("end-activate-extension");

    // At startup: show Explorer sidebar, close Welcome tab, set up 2-group layout
    vscode.commands.executeCommand("workbench.view.explorer");
    vscode.commands.executeCommand("workbench.action.closeAllEditors");

    setTimeout(async () => {
        const arduinoManagerProvider = new arduinoContentProviderModule.ArduinoContentProvider(context.extensionPath);
        await arduinoManagerProvider.initialize();

        const openHomePanel = (view?: string) => {
            arduinoHomePanelModule.ArduinoHomePanel.createOrShow(
                context.extensionUri,
                arduinoManagerProvider.serverUrl,
                arduinoManagerProvider.authToken,
                view,
            );
        };

        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ARDUINO_MANAGER_PROTOCOL, arduinoManagerProvider));
        context.subscriptions.push(vscode.commands.registerCommand("arduino.showBoardManager", () => {
            openHomePanel("boardmanager");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("arduino.showLibraryManager", () => {
            openHomePanel("librarymanager");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("arduino.showBoardConfig", () => {
            openHomePanel("boardConfig");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("arduino.showExamples", (forceRefresh: boolean = false) => {
            vscode.commands.executeCommand("setContext", "vscode-arduino:showExampleExplorer", true);
            if (forceRefresh) {
                vscode.commands.executeCommand("arduino.reloadExample");
            }
            openHomePanel("examples");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("arduino.showHome", () => {
            openHomePanel();
        }));

        // Auto-open home panel when the sidebar tree view becomes visible (activity bar click)
        context.subscriptions.push(quickAccessTreeView.onDidChangeVisibility((e) => {
            if (e.visible) {
                openHomePanel();
            }
        }));

        // Startup layout: Home Panel in group 1, .ino file in group 2
        // Set editor layout: 2 groups side by side (~38% / 62%)
        await vscode.commands.executeCommand("vscode.setEditorLayout", {
            orientation: 0,
            groups: [{ size: 0.38 }, { size: 0.62 }],
        });

        // Open Home Panel in group 1 (ViewColumn.One) with welcome screen
        openHomePanel();

        // Re-open .ino file in group 2 (ViewColumn.Two) if one exists in workspace
        const inoFiles = await vscode.workspace.findFiles("**/*.ino", null, 1);
        if (inoFiles.length > 0) {
            await vscode.commands.executeCommand("setContext", "arduino.hasProject", true);
            await vscode.commands.executeCommand("vscode.open", inoFiles[0], vscode.ViewColumn.Two);
        }

        // change board type
        registerArduinoCommand("arduino.changeBoardType", async () => {
            try {
                await arduinoContextModule.default.boardManager.changeBoardType();
            } catch (exception) {
                Logger.error(exception.message);
            }
            arduinoManagerProvider.update(LIBRARY_MANAGER_URI);
            arduinoManagerProvider.update(EXAMPLES_URI);
        }, () => {
            return { board: arduinoContextModule.default.boardManager.currentBoard.name };
        });
        registerArduinoCommand("arduino.reloadExample", () => {
            arduinoManagerProvider.update(EXAMPLES_URI);
        }, () => {
            return {
                board: (arduinoContextModule.default.boardManager.currentBoard === null) ? null :
                    arduinoContextModule.default.boardManager.currentBoard.name,
            };
        });

    }, 100);

    setTimeout(() => {
        // delay to detect usb
        usbDetectorModule.UsbDetector.getInstance().initialize(context.extensionPath);
        usbDetectorModule.UsbDetector.getInstance().startListening();
    }, 200);

    // Silently check for Arduino CLI updates (downloaded CLIs only)
    setTimeout(() => {
        checkForCliUpdate(context.extensionPath).catch(() => { /* ignore */ });
    }, 5000);
}

export async function deactivate() {
    usbDetectorModule.UsbDetector.getInstance().stopListening();
    Logger.traceUserData("deactivate-extension");
}
