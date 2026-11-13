// Copyright (c) electropol-fr. All rights reserved.
// Licensed under the MIT license.

import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { cliEnv } from "../common/cliEnv";
import { arduinoChannel } from "../common/outputChannel";
import { getExecutableFileName, resolveArduinoPath } from "../common/platform";
import { BIBLIOTHEQUES_DE_BASE, listeInstallees, lotDeBaseComplet } from "./arduinoLibs";
import { downloadArduinoCli, getDownloadedCliExecutable } from "./cliDownloader";
import { getCppExtensionId, getCppExtensionName, isCppExtensionInstalled } from "./cppSupport";

const execFileAsync = promisify(child_process.execFile);

// Cœur installé d'office : c'est le seul qui apporte avr-gcc et avrdude,
// donc la seule chose qui rend une Uno/Nano/Mega compilable et téléversable.
const DEFAULT_CORE = "arduino:avr";

const SETUP_PROMPT_STATE_KEY = "arduino.environmentSetupPrompt";

export interface IEnvironmentStatus {
    /** Un arduino-cli réellement invocable a été trouvé. */
    hasCli: boolean;
    /** Au moins un cœur (plateforme) est installé : sans cela, aucune compilation possible. */
    hasCore: boolean;
    /** L'extension IntelliSense de l'hôte est installée (C/C++ ou clangd). */
    hasCppTools: boolean;
    /**
     * Les bibliothèques de base d'Arduino (Servo, Stepper, LiquidCrystal…) sont installées.
     * Faux si au moins une manque — Arduino_BuiltIn rattrape tout le lot d'un coup.
     * Valeur indéterminée (null) si le CLI n'a pas répondu : l'appelant ne conclut pas à une absence.
     */
    hasBuiltInLibraries: boolean | null;
}

/**
 * Le CLI répond-il ? On ne se contente pas de l'existence du fichier :
 * un binaire tronqué ou d'une architecture étrangère existe sans fonctionner.
 */
async function cliResponds(commandPath: string): Promise<boolean> {
    try {
        await execFileAsync(commandPath, ["version"], { timeout: 8000, windowsHide: true, env: cliEnv() });
        return true;
    } catch {
        return false;
    }
}

/**
 * Liste les cœurs installés via le CLI. Retourne null si le CLI n'a pas répondu
 * (indéterminé), un tableau éventuellement vide sinon.
 */
async function listInstalledCores(commandPath: string): Promise<string[] | null> {
    const parse = (stdout: string): string[] => {
        const parsed = JSON.parse(stdout);
        // Selon la version du CLI : { platforms: [...] } ou directement un tableau
        const platforms = Array.isArray(parsed) ? parsed : (parsed.platforms || []);
        return platforms
            // `installed_version` distingue une plateforme réellement installée d'une simple
            // entrée d'index : selon la version, le CLI peut lister les deux.
            .filter((p: any) => !!(p.installed_version || p.installedVersion
                || (p.metadata && p.metadata.installed_version)))
            .map((p: any) => p.id || (p.metadata && p.metadata.id) || "")
            .filter((id: string) => !!id);
    };
    try {
        const { stdout } = await execFileAsync(commandPath, ["core", "list", "--json"],
            { timeout: 15000, windowsHide: true, env: cliEnv(), maxBuffer: 8 * 1024 * 1024 });
        return parse(stdout);
    } catch {
        // Anciennes versions du CLI (< 1.0) : --json s'écrivait --format json
        try {
            const { stdout } = await execFileAsync(commandPath, ["core", "list", "--format", "json"],
                { timeout: 15000, windowsHide: true, env: cliEnv(), maxBuffer: 8 * 1024 * 1024 });
            return parse(stdout);
        } catch {
            return null;
        }
    }
}

/**
 * Repli hors CLI : un cœur installé se voit au dossier `packages/<éditeur>/hardware`
 * du dossier de données du CLI. Sert quand le CLI ne répond pas.
 */
function hasCoreOnDisk(packagePath: string): boolean {
    if (!packagePath) {
        return false;
    }
    const packagesDir = path.join(packagePath, "packages");
    try {
        for (const vendor of fs.readdirSync(packagesDir)) {
            const hardwareDir = path.join(packagesDir, vendor, "hardware");
            if (!fs.existsSync(hardwareDir)) {
                continue;
            }
            for (const arch of fs.readdirSync(hardwareDir)) {
                // Un cœur réellement installé contient au moins une version avec boards.txt
                const archDir = path.join(hardwareDir, arch);
                for (const version of fs.readdirSync(archDir)) {
                    if (fs.existsSync(path.join(archDir, version, "boards.txt"))) {
                        return true;
                    }
                }
            }
        }
    } catch {
        // Dossier absent ou illisible : pas de cœur détectable
    }
    return false;
}

/**
 * État de l'environnement de programmation Arduino.
 * @param commandPath chemin de l'exécutable arduino-cli résolu par les réglages
 * @param packagePath dossier de données du CLI (pour le repli hors CLI)
 */
export async function getEnvironmentStatus(
    commandPath: string,
    packagePath: string,
    extensionPath?: string,
): Promise<IEnvironmentStatus> {
    let resolvedCli = (commandPath && await cliResponds(commandPath)) ? commandPath : "";
    if (!resolvedCli) {
        // Le chemin fourni peut manquer : l'application Arduino n'est initialisée qu'à la
        // première commande, donc au démarrage les réglages ne sont pas encore résolus.
        // Refaire la résolution ici évite d'annoncer un environnement absent alors qu'il
        // est complet.
        resolvedCli = await findUsableCli(extensionPath);
    }
    const hasCli = !!resolvedCli;
    let hasCore = false;
    let hasBuiltInLibraries: boolean | null = null;
    if (hasCli) {
        const cores = await listInstalledCores(resolvedCli);
        hasCore = cores === null
            ? (hasCoreOnDisk(packagePath) || hasCoreOnDisk(defaultDataDirectory()))
            : cores.length > 0;
        // Sans cœur, la question des bibliothèques de base ne se pose pas encore :
        // le parcours commencera par le cœur, le lot `Arduino_BuiltIn` suivra.
        if (hasCore) {
            const libs = await listeInstallees(resolvedCli);
            hasBuiltInLibraries = libs === null ? null : lotDeBaseComplet(libs);
        }
    } else {
        hasCore = hasCoreOnDisk(packagePath) || hasCoreOnDisk(defaultDataDirectory());
    }
    return {
        hasCli,
        hasCore,
        hasCppTools: isCppExtensionInstalled(),
        hasBuiltInLibraries,
    };
}

/**
 * Dossier de données par défaut du CLI, utilisé quand les réglages n'ont pas encore
 * été résolus (packagePath vide).
 */
function defaultDataDirectory(): string {
    if (process.platform === "win32") {
        return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Arduino15") : "";
    }
    if (process.platform === "darwin") {
        return process.env.HOME ? path.join(process.env.HOME, "Library", "Arduino15") : "";
    }
    return process.env.HOME ? path.join(process.env.HOME, ".arduino15") : "";
}

/**
 * Cherche un arduino-cli réellement invocable, indépendamment des réglages :
 * réglage explicite, CLI téléchargé par l'extension, puis résolution système
 * (PATH, Arduino IDE 2).
 */
async function findUsableCli(extensionPath?: string): Promise<string> {
    const candidates: string[] = [];

    const configured = vscode.workspace.getConfiguration("arduino").get<string>("commandPath");
    const configuredRoot = vscode.workspace.getConfiguration("arduino").get<string>("path");
    if (configured) {
        candidates.push(path.isAbsolute(configured) || !configuredRoot
            ? configured
            : path.join(configuredRoot, configured));
    } else if (configuredRoot) {
        candidates.push(path.join(configuredRoot, getExecutableFileName("arduino-cli")));
    }

    if (extensionPath) {
        const downloaded = getDownloadedCliExecutable(extensionPath);
        if (downloaded) {
            candidates.push(downloaded);
        }
    }

    try {
        const resolvedRoot = await Promise.resolve<string>(resolveArduinoPath() as any);
        if (resolvedRoot) {
            candidates.push(path.join(resolvedRoot, getExecutableFileName("arduino-cli")));
        }
    } catch {
        // Résolution système indisponible : les autres pistes restent valables
    }

    for (const candidate of candidates) {
        if (candidate && await cliResponds(candidate)) {
            return candidate;
        }
    }
    return "";
}

/**
 * Lance une commande du CLI en renvoyant sa sortie dans le canal Arduino.
 */
function runCli(commandPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn(commandPath, args, { windowsHide: true, env: cliEnv() });
        const relay = (data: Buffer) => {
            const text = data.toString().replace(/\r?\n$/, "");
            if (text) {
                arduinoChannel.channel.appendLine(text);
            }
        };
        child.stdout.on("data", relay);
        child.stderr.on("data", relay);
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(vscode.l10n.t("Exit with code={0}", code)));
            }
        });
    });
}

export interface ISetupResult {
    /** Le CLI vient d'être téléchargé : les réglages doivent être réinitialisés. */
    cliInstalled: boolean;
    /** Le cœur arduino:avr a été installé pendant ce parcours. */
    coreInstalled: boolean;
    /** Le lot `Arduino_BuiltIn` (Servo, Stepper, LiquidCrystal…) a été installé pendant ce parcours. */
    builtInInstalled: boolean;
    /** Toutes les étapes indispensables sont satisfaites. */
    ready: boolean;
}

/**
 * Parcours complet d'installation : arduino-cli, index des paquets, cœur arduino:avr,
 * puis extension C/C++ pour l'IntelliSense. Chaque étape est sautée si déjà satisfaite.
 *
 * @param extensionPath dossier de l'extension (destination du CLI téléchargé)
 * @param resolveCommandPath fournit le chemin courant du CLI ; rappelé après téléchargement
 * @param additionalUrlsArgs flags `--additional-urls` à transmettre au CLI
 */
export async function setupEnvironment(
    extensionPath: string,
    resolveCommandPath: () => string,
    additionalUrlsArgs: () => string[],
): Promise<ISetupResult> {
    const result: ISetupResult = {
        cliInstalled: false,
        coreInstalled: false,
        builtInInstalled: false,
        ready: false,
    };
    arduinoChannel.show();
    arduinoChannel.start(vscode.l10n.t("Set up the Arduino environment..."));

    // Étape 1 : arduino-cli
    let commandPath = resolveCommandPath();
    if (!commandPath || !await cliResponds(commandPath)) {
        // Même recherche que le diagnostic : un CLI déjà présent (Arduino IDE 2, PATH,
        // téléchargement précédent) ne doit pas être retéléchargé.
        const found = await findUsableCli(extensionPath);
        if (found) {
            commandPath = found;
        } else {
            arduinoChannel.info(vscode.l10n.t("Arduino CLI not found: downloading it."));
            // Le dossier d'installation depend du contexte (stockage global ou dossier de
            // l'extension) : on prend celui que le telechargement renvoie, sans le deviner.
            const installedDir = await downloadArduinoCli(extensionPath);
            commandPath = getDownloadedCliExecutable(extensionPath)
                || path.join(installedDir, getExecutableFileName("arduino-cli"));
            result.cliInstalled = true;
        }
    } else {
        arduinoChannel.info(vscode.l10n.t("Arduino CLI found: {0}", commandPath));
    }

    if (!await cliResponds(commandPath)) {
        arduinoChannel.error(vscode.l10n.t("Arduino CLI is still unusable: {0}", commandPath));
        throw new Error(vscode.l10n.t("Arduino CLI is still unusable: {0}", commandPath));
    }

    // Étape 2 : index des paquets, sans quoi `core install` ne trouve rien
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Arduino environment"),
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: vscode.l10n.t("Updating package index...") });
        try {
            await runCli(commandPath, ["core", "update-index", ...additionalUrlsArgs()]);
        } catch (error) {
            // Index déjà présent ou réseau capricieux : l'installation du cœur tranchera
            arduinoChannel.warning(vscode.l10n.t("Package index update failed: {0}", error.message));
        }

        // Étape 3 : cœur arduino:avr (avr-gcc + avrdude)
        const cores = await listInstalledCores(commandPath);
        const hasAvr = cores !== null && cores.some((id) => id.toLowerCase() === DEFAULT_CORE);
        if (!hasAvr) {
            progress.report({ message: vscode.l10n.t("Installing the {0} core...", DEFAULT_CORE) });
            arduinoChannel.info(vscode.l10n.t("Installing the {0} core...", DEFAULT_CORE));
            await runCli(commandPath, ["core", "install", DEFAULT_CORE, ...additionalUrlsArgs()]);
            result.coreInstalled = true;
        } else {
            arduinoChannel.info(vscode.l10n.t("The {0} core is already installed.", DEFAULT_CORE));
        }

        // Étape 4 : index des bibliothèques, pour que le gestionnaire soit utilisable d'emblée
        progress.report({ message: vscode.l10n.t("Updating library index...") });
        try {
            await runCli(commandPath, ["lib", "update-index"]);
        } catch (error) {
            arduinoChannel.warning(vscode.l10n.t("Library index update failed: {0}", error.message));
        }

        // Étape 5 : bibliothèques de base d'Arduino (Servo, Stepper, LiquidCrystal, Ethernet,
        // SD, Keyboard, Mouse, TFT, Firmata). Elles ne sont PAS dans le cœur arduino:avr :
        // Arduino IDE 2 les installe au premier lancement via la méta `Arduino_BuiltIn`,
        // mais arduino-cli ne le fait jamais. Sans cela, un .ino avec `#include <Servo.h>`
        // échoue en compilation sur un poste où l'IDE n'a jamais été ouvert. Jamais bloquant :
        // le réseau peut manquer, le reste de l'environnement est déjà utilisable.
        const installed = await listeInstallees(commandPath);
        const needsBuiltIn = installed !== null && !lotDeBaseComplet(installed);
        if (needsBuiltIn) {
            progress.report({ message: vscode.l10n.t("Installing the {0} library bundle...", BIBLIOTHEQUES_DE_BASE) });
            arduinoChannel.info(vscode.l10n.t("Installing the {0} library bundle (Servo, Stepper, LiquidCrystal, Ethernet, SD, Keyboard, Mouse, TFT, Firmata)...", BIBLIOTHEQUES_DE_BASE));
            try {
                await runCli(commandPath, ["lib", "install", BIBLIOTHEQUES_DE_BASE]);
                result.builtInInstalled = true;
            } catch (error) {
                arduinoChannel.warning(vscode.l10n.t("Installation of the {0} library bundle failed: {1}", BIBLIOTHEQUES_DE_BASE, error.message));
            }
        } else if (installed !== null) {
            arduinoChannel.info(vscode.l10n.t("The {0} library bundle is already installed.", BIBLIOTHEQUES_DE_BASE));
        }
    });

    // Étape 5 : extension IntelliSense (facultative, jamais bloquante). Selon l'hôte,
    // C/C++ de Microsoft ou clangd — voir cppSupport.
    if (!isCppExtensionInstalled()) {
        await installCppTools();
    }

    result.ready = true;
    arduinoChannel.end(vscode.l10n.t("Arduino environment ready."));
    return result;
}

/**
 * Installe l'extension qui fournit l'IntelliSense, avec repli sur la recherche
 * du registre d'extensions si l'installation directe échoue.
 *
 * L'extension proposée dépend de l'hôte : « C/C++ » de Microsoft sur VS Code
 * officiel, clangd sur VSCodium et dérivés (cpptools y est absent d'Open VSX,
 * sa licence en interdisant la redistribution).
 */
async function installCppTools(): Promise<void> {
    const extensionId = getCppExtensionId();
    const name = getCppExtensionName();
    const install = vscode.l10n.t("Install {0}", name);
    const skip = vscode.l10n.t("Skip");
    const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t("Install the \"{0}\" extension to get IntelliSense (completion, navigation, error checking) in your sketches.", name),
        install,
        skip,
    );
    if (choice !== install) {
        return;
    }
    try {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId);
        arduinoChannel.info(vscode.l10n.t("\"{0}\" extension installed.", name));
    } catch (error) {
        void vscode.window.showWarningMessage(vscode.l10n.t("Unable to install the \"{0}\" extension automatically.", name));
        await vscode.commands.executeCommand("workbench.extensions.search", `@id:${extensionId}`);
    }
}

/**
 * Notification unique proposant le parcours d'installation quand l'environnement
 * est incomplet. Remplace l'ancien prompt qui ne parlait que du CLI : un CLI seul
 * ne compile rien, faute de cœur.
 *
 * Non bloquante par construction : appelée hors du chemin critique d'activation.
 */
export async function promptSetupEnvironment(
    context: vscode.ExtensionContext,
    status: IEnvironmentStatus,
): Promise<boolean> {
    // CLI + cœur + lot de base présents (ou indéterminé pour ce dernier, prudence) : rien à proposer.
    if (status.hasCli && status.hasCore && status.hasBuiltInLibraries !== false) {
        return false;
    }

    const state = context.globalState.get<{ dismissedForever?: boolean }>(SETUP_PROMPT_STATE_KEY);
    if (state && state.dismissedForever) {
        return false;
    }

    let message: string;
    if (!status.hasCli) {
        message = vscode.l10n.t("The Arduino environment is missing: Arduino CLI and a board core are needed to compile and upload. Install everything now?");
    } else if (!status.hasCore) {
        message = vscode.l10n.t("No board core is installed: nothing can be compiled or uploaded. Install the {0} core now?", DEFAULT_CORE);
    } else {
        // CLI et cœur présents, mais les bibliothèques de base manquent (Servo, Stepper…).
        // Sans elles, un croquis avec #include <Servo.h> échoue en compilation.
        message = vscode.l10n.t("The Arduino base libraries (Servo, Stepper, LiquidCrystal…) are not installed. Without them, many sketches will not compile. Install the {0} library bundle now?", BIBLIOTHEQUES_DE_BASE);
    }

    const installAction = vscode.l10n.t("Install");
    const neverAction = vscode.l10n.t("Don't show again");
    const choice = await vscode.window.showWarningMessage(
        message,
        installAction,
        vscode.l10n.t("Later"),
        neverAction,
    );

    if (choice === neverAction) {
        await context.globalState.update(SETUP_PROMPT_STATE_KEY, { dismissedForever: true });
        return false;
    }
    return choice === installAction;
}
