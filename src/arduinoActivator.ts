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
    private _arduinoApp: ArduinoApp;
    private _arduinoSettings: ArduinoSettings;

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

            // Si aucun arduino-cli réellement invocable n'est présent, proposer le téléchargement.
            // Ce prompt NE DOIT PAS bloquer ni faire échouer l'activation : attendre le clic de
            // l'utilisateur pendant activate() peut faire annuler l'activation par VS Code
            // (erreur "Canceled") et laisse l'extension sans cartes ni bibliothèques. On le lance
            // donc en arrière-plan ; les cartes/bibliothèques déjà installées restent lisibles
            // depuis les fichiers d'index, sans CLI.
            if (!arduinoSettings.usableCli && this._extensionPath) {
                this.promptAndReloadCli(arduinoSettings);
            }

            const arduinoApp = new ArduinoApp(arduinoSettings);

            // Initializing the app before the device context will cause a
            // setting changed event that triggers analysis.
            const analyzeOnOpen = VscodeSettings.getInstance().analyzeOnOpen;
            if (analyzeOnOpen) {
                await arduinoApp.initialize();
            }

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

            this._arduinoApp = arduinoApp;
            this._arduinoSettings = arduinoSettings;
        })().catch((error) => {
            // Ne pas garder en cache une initialisation échouée : permettre un nouvel essai
            this._initializePromise = undefined;
            throw error;
        });
        await this._initializePromise;
    }

    /**
     * Propose (hors du chemin critique d'activation) de télécharger arduino-cli, puis
     * réinitialise les réglages et recharge cartes/bibliothèques une fois le CLI présent.
     */
    private promptAndReloadCli(arduinoSettings: ArduinoSettings): void {
        promptDownloadCli(this._extensionPath).then(async (downloadedDir) => {
            if (!downloadedDir) {
                return;
            }
            await arduinoSettings.initialize(this._extensionPath);
            if (this._arduinoApp) {
                await this._arduinoApp.initialize(true);
                if (this._arduinoApp.boardManager) {
                    await this._arduinoApp.boardManager.loadPackages(true);
                }
                if (this._arduinoApp.libraryManager) {
                    await this._arduinoApp.libraryManager.loadLibraries(true);
                }
            }
        }).catch(() => {
            // Échec silencieux : l'utilisateur peut relancer via la commande d'installation du CLI
        });
    }
}
export default new ArduinoActivator();
