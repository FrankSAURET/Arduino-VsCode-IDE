// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

import { ArduinoApp } from "./arduino/arduino";
import { ArduinoSettings } from "./arduino/arduinoSettings";
import { BoardManager } from "./arduino/boardManager";
import { promptDownloadCli } from "./arduino/cliDownloader";
import { ExampleManager } from "./arduino/exampleManager";
import { ExampleProvider } from "./arduino/exampleProvider";
import { LibraryManager } from "./arduino/libraryManager";
import { ProgrammerManager } from "./arduino/programmerManager";
import { VscodeSettings } from "./arduino/vscodeSettings";
import ArduinoContext from "./arduinoContext";
import { DeviceContext } from "./deviceContext";

class ArduinoActivator {
    private _initializePromise: Promise<void>;
    private _extensionPath: string = "";

    public setExtensionPath(extensionPath: string) {
        this._extensionPath = extensionPath;
    }

    public async activate() {
        if (this._initializePromise) {
            await this._initializePromise;
            return;
        }

        this._initializePromise = (async () => {
            const arduinoSettings = new ArduinoSettings();
            await arduinoSettings.initialize(this._extensionPath);

            // If no Arduino CLI path is found, offer to download it.
            if ((!arduinoSettings.arduinoPath || !arduinoSettings.arduinoPath.trim()) && this._extensionPath) {
                const downloadedDir = await promptDownloadCli(this._extensionPath);
                if (downloadedDir) {
                    await arduinoSettings.initialize(this._extensionPath);
                }
            }

            const arduinoApp = new ArduinoApp(arduinoSettings);

            // Initializing the app before the device context will cause a
            // setting changed event that triggers analysis.
            const analyzeOnOpen = VscodeSettings.getInstance().analyzeOnOpen;
            if (analyzeOnOpen) {
                await arduinoApp.initialize();
            }

            // TODO: After use the device.json config, should remove the dependency on the ArduinoApp object.
            const deviceContext = DeviceContext.getInstance();
            await deviceContext.loadContext();

            if (!analyzeOnOpen) {
                await arduinoApp.initialize();
            }

            // Show sketch status bar, and allow user to change sketch in config file
            deviceContext.showStatusBar();
            // Arduino board manager & library manager
            arduinoApp.boardManager = new BoardManager(arduinoSettings, arduinoApp);
            ArduinoContext.boardManager = arduinoApp.boardManager;
            await arduinoApp.boardManager.loadPackages();
            arduinoApp.libraryManager = new LibraryManager(arduinoSettings, arduinoApp);
            arduinoApp.exampleManager = new ExampleManager(arduinoSettings, arduinoApp);
            arduinoApp.programmerManager = new ProgrammerManager(arduinoSettings, arduinoApp);
            ArduinoContext.arduinoApp = arduinoApp;

            const exampleProvider = new ExampleProvider(arduinoApp.exampleManager, arduinoApp.boardManager);
            vscode.window.registerTreeDataProvider("arduinoExampleExplorer", exampleProvider);
        })();
        await this._initializePromise;
    }
}
export default new ArduinoActivator();
