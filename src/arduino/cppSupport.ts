// Copyright (c) electropol-fr. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import * as constants from "../common/constants";
import { arduinoChannel } from "../common/outputChannel";
import { ArduinoWorkspace } from "../common/workspace";

export const CPPTOOLS_EXTENSION_ID = "ms-vscode.cpptools";
export const CLANGD_EXTENSION_ID = "llvm-vs-code-extensions.vscode-clangd";

/**
 * Moteur IntelliSense retenu pour l'hôte courant.
 *
 * `ms-vscode.cpptools` est sous licence Microsoft : absent d'Open VSX et, même
 * installé de force, son serveur refuse de démarrer hors de VS Code officiel.
 * Sur VSCodium et dérivés on bascule donc sur clangd, qui est libre, présent sur
 * Open VSX, et se nourrit d'un `compile_commands.json` qu'arduino-cli sait produire.
 */
export enum CppEngine {
    /** Extension C/C++ de Microsoft : consomme `c_cpp_properties.json`. */
    CppTools = "cpptools",
    /** clangd : consomme `compile_commands.json`. */
    Clangd = "clangd",
}

/**
 * Vrai si l'hôte est une version officielle de VS Code (ou l'un de ses canaux
 * signés : Insiders, Exploration). Tout le reste — VSCodium, Cursor, Windsurf,
 * code-server, Eclipse Theia — n'a pas le droit d'exécuter cpptools.
 *
 * La marque produit est le seul discriminant fiable : `vscode.env.appName` est
 * personnalisable par le distributeur, alors que `vscode.env.uriScheme` suit la
 * construction (`vscode`, `vscode-insiders`, `vscodium`, `cursor`...).
 */
export function isOfficialVSCode(): boolean {
    const scheme = (vscode.env.uriScheme || "").toLowerCase();
    if (scheme === "vscode" || scheme === "vscode-insiders" || scheme === "vscode-exploration") {
        // code-server et les bureaux distants gardent le schéma « vscode » tout en
        // étant des constructions libres : le nom d'application les démasque.
        const appName = (vscode.env.appName || "").toLowerCase();
        return !appName.includes("codium")
            && !appName.includes("code - oss")
            && !appName.includes("code-oss")
            && !appName.includes("theia");
    }
    return false;
}

/**
 * Moteur à utiliser. Un réglage explicite (`arduino.intelliSenseEngine`) prime
 * toujours : il permet de forcer clangd sur VS Code officiel, ou d'utiliser un
 * cpptools installé à la main sur une construction dérivée.
 */
export function getCppEngine(): CppEngine {
    const configured = vscode.workspace.getConfiguration("arduino")
        .get<string>("intelliSenseEngine", "auto");
    if (configured === CppEngine.CppTools || configured === CppEngine.Clangd) {
        return configured as CppEngine;
    }

    // « auto » : l'extension déjà installée gagne, sinon c'est l'hôte qui tranche.
    if (vscode.extensions.getExtension(CPPTOOLS_EXTENSION_ID) && isOfficialVSCode()) {
        return CppEngine.CppTools;
    }
    if (vscode.extensions.getExtension(CLANGD_EXTENSION_ID)) {
        return CppEngine.Clangd;
    }
    return isOfficialVSCode() ? CppEngine.CppTools : CppEngine.Clangd;
}

/** Identifiant de l'extension à installer pour le moteur courant. */
export function getCppExtensionId(engine: CppEngine = getCppEngine()): string {
    return engine === CppEngine.Clangd ? CLANGD_EXTENSION_ID : CPPTOOLS_EXTENSION_ID;
}

/** Nom affiché de l'extension du moteur courant (jamais traduit : c'est un nom propre). */
export function getCppExtensionName(engine: CppEngine = getCppEngine()): string {
    return engine === CppEngine.Clangd ? "clangd" : "C/C++";
}

/** L'extension fournissant l'IntelliSense pour le moteur courant est-elle installée ? */
export function isCppExtensionInstalled(engine: CppEngine = getCppEngine()): boolean {
    return !!vscode.extensions.getExtension(getCppExtensionId(engine));
}

/** Une entrée de `compile_commands.json` telle que produite par arduino-cli. */
export interface ICompileCommand {
    directory: string;
    arguments: string[];
    file: string;
}

/**
 * Options d'optimisation propres à gcc que clang ne connaît pas. Elles ne changent
 * rien à l'analyse sémantique, mais clang s'arrête dessus en signalant une option
 * inconnue sur chaque fichier.
 *
 * `-mmcu` n'en fait PAS partie et ne doit jamais être retiré : sans lui, et sans le
 * `--target` ajouté ci-dessous, clang analyse pour x86 et rejette tout l'assembleur
 * en ligne d'avr-libc (« invalid output constraint '=w' in asm » dès <util/delay.h>).
 */
const CLANGD_REMOVED_FLAGS = [
    "-flto",
    "-fno-fat-lto-objects",
    "-ffat-lto-objects",
    "-fno-tree-scev-cprop",
    "-fno-devirtualize",
    "-mrelax",
    "-mcall-prologues",
    "-nodevicelib",
    "--param=*",
    "-MMD",
];

/**
 * Options ajoutées à toute analyse clangd :
 *  - `-Wno-unknown-attributes` : PROGMEM se résout en `__attribute__((__progmem__))`,
 *    propre à avr-gcc ; sans cela chaque table en mémoire programme est soulignée.
 *  - `-Wno-#warnings` : avr-libc émet un #warning quand les optimisations sont
 *    coupées, ce qui arrive selon la façon dont clangd rejoue la ligne de commande.
 */
const CLANGD_ADDED_FLAGS = [
    "-Wno-unknown-attributes",
    "-Wno-#warnings",
];

/**
 * Triplet de cible clang déduit du compilateur de la base de compilation.
 * Sans cible explicite, clang analyse pour la machine hôte et rejette l'assembleur
 * en ligne du cœur (registres et contraintes propres au microcontrôleur).
 */
export function targetForCompiler(compilerPath: string): string | undefined {
    const compiler = path.basename(compilerPath).toLowerCase();
    if (compiler.startsWith("avr-")) {
        return "avr";
    }
    if (compiler.startsWith("arm-none-eabi-")) {
        // Pico, SAMD, STM32 : cible bare-metal ARM, sans système d'exploitation.
        return "arm-none-eabi";
    }
    if (compiler.startsWith("xtensa-")) {
        // ESP8266 et ESP32 d'origine : clang ne sait pas viser Xtensa, laisser
        // l'analyse en natif donne un résultat imparfait mais utilisable.
        return undefined;
    }
    if (compiler.startsWith("riscv32-")) {
        return "riscv32";
    }
    return undefined;
}

/**
 * Écrit le fichier `.clangd` du projet : cible du microcontrôleur, retrait des
 * options gcc inconnues de clang, et inclusion forcée d'Arduino.h — l'équivalent
 * du `forcedInclude` de cpptools, sans quoi les symboles Arduino sont introuvables
 * dans un `.ino` qui n'inclut rien.
 *
 * Le fichier n'est réécrit que si son contenu change : clangd le surveille et
 * réindexe tout le projet à chaque écriture.
 */
export function writeClangdConfig(rootPath: string, arduinoHeaderPath?: string, compilerPath?: string): void {
    if (!rootPath) {
        return;
    }

    const added = [...CLANGD_ADDED_FLAGS];

    const target = compilerPath ? targetForCompiler(compilerPath) : undefined;
    if (target) {
        added.unshift(`--target=${target}`);
    }

    if (compilerPath) {
        // `-isystem` et non `-I` : ces en-têtes ne sont pas les nôtres, leurs
        // avertissements n'ont pas à remonter dans le projet de l'utilisateur.
        for (const includePath of toolchainIncludePaths(compilerPath)) {
            added.push(`-isystem${includePath.replace(/\\/g, "/")}`);
        }
    }

    if (arduinoHeaderPath) {
        // clangd n'a pas d'équivalent de « forcedInclude » : -include joue ce rôle.
        added.push(`-include${arduinoHeaderPath.replace(/\\/g, "/")}`);
    }

    const lines: string[] = [
        "# Généré par Arduino VsCode IDE — ne pas modifier à la main.",
        "# Adapte la base de compilation d'arduino-cli à clang, qui ne partage",
        "# ni les options ni les extensions d'avr-gcc.",
        "CompileFlags:",
        "  Remove:",
        ...CLANGD_REMOVED_FLAGS.map((flag) => `    - ${flag}`),
        "  Add:",
        ...added.map((flag) => `    - ${flag}`),
        "",
    ];

    const content = lines.join("\n");
    const configPath = path.join(rootPath, constants.CLANGD_CONFIG_FILE);
    try {
        if (fs.existsSync(configPath) && fs.readFileSync(configPath, "utf8") === content) {
            return;
        }
        fs.writeFileSync(configPath, content, "utf8");
    } catch (error) {
        arduinoChannel.warning(vscode.l10n.t("Unable to write the \"{0}\" file: {1}",
            constants.CLANGD_CONFIG_FILE, error.message));
    }
}

/**
 * Compilateur utilisé par la base de compilation, pour en déduire la cible clang.
 */
export function readCompilerFromDatabase(rootPath: string): string | undefined {
    try {
        const dbPath = path.join(rootPath, constants.COMPILE_COMMANDS_FILE);
        const entries = JSON.parse(fs.readFileSync(dbPath, "utf8")) as ICompileCommand[];
        const entry = entries.find((e) => Array.isArray(e.arguments) && e.arguments.length > 0);
        return entry ? entry.arguments[0] : undefined;
    } catch {
        return undefined;
    }
}

/**
 * En-têtes que la chaîne gcc connaît implicitement mais qui ne figurent nulle part
 * dans la base de compilation : avr-gcc trouve `<avr/pgmspace.h>` sans qu'aucun `-I`
 * ne le désigne, clang non — il s'arrête sur « 'avr/pgmspace.h' file not found » dès
 * la première ligne d'Arduino.h.
 *
 * On reconstitue ces chemins à partir du compilateur. Disposition classique d'une
 * chaîne croisée gcc, la même pour avr, arm-none-eabi et riscv :
 *   <racine>/<cible>/include            en-têtes de la bibliothèque C (avr-libc, newlib)
 *   <racine>/lib/gcc/<cible>/<ver>/include   en-têtes internes du compilateur
 *
 * @param compilerPath chemin complet du compilateur, premier argument de la base
 * @returns chemins existants, dans l'ordre où clang doit les consulter
 */
function toolchainIncludePaths(compilerPath: string): string[] {
    const compiler = path.basename(compilerPath).toLowerCase();
    const match = compiler.match(/^(.+?)-(?:gcc|g\+\+|cc|c\+\+)(?:\.exe)?$/);
    if (!match) {
        return [];
    }
    const targetTriple = match[1];
    // <racine>/bin/<cible>-g++ : deux niveaux au-dessus du binaire.
    const root = path.resolve(path.dirname(compilerPath), "..");

    const candidates: string[] = [path.join(root, targetTriple, "include")];

    const gccLibDir = path.join(root, "lib", "gcc", targetTriple);
    try {
        for (const version of fs.readdirSync(gccLibDir)) {
            candidates.push(path.join(gccLibDir, version, "include"));
            candidates.push(path.join(gccLibDir, version, "include-fixed"));
        }
    } catch {
        // Chaîne d'outils de disposition inhabituelle : les autres chemins suffisent
        // le plus souvent, clang se rabattant sur ses propres en-têtes.
    }

    return candidates.filter((candidate) => fs.existsSync(candidate));
}

/**
 * arduino-cli ne compile jamais le `.ino` directement : il le recopie en
 * `<build>/sketch/<nom>.ino.cpp` avec les prototypes ajoutés, et c'est ce fichier
 * généré qui figure dans la base. clangd n'y trouve donc rien pour le `.ino` que
 * l'utilisateur a sous les yeux, et le laisse sans IntelliSense.
 *
 * On duplique donc chaque entrée visant un `.ino.cpp` vers le fichier source
 * correspondant. Les `.ino` secondaires du croquis, concaténés dans le même
 * `.ino.cpp` par le CLI, reçoivent la même ligne de commande.
 */
export function addSketchEntries(entries: ICompileCommand[], _rootPath: string, sketchDir: string): ICompileCommand[] {
    const result = [...entries];
    const known = new Set(entries.map((entry) => path.resolve(entry.file).toLowerCase()));

    for (const entry of entries) {
        if (!/\.ino\.cpp$/i.test(entry.file)) {
            continue;
        }

        // Tous les .ino du croquis partagent la ligne de commande du .ino.cpp :
        // le CLI les a concaténés dans ce seul fichier de traduction.
        let sources: string[] = [];
        try {
            sources = fs.readdirSync(sketchDir)
                .filter((name) => /\.ino$/i.test(name))
                .map((name) => path.join(sketchDir, name));
        } catch {
            continue;
        }

        for (const source of sources) {
            if (known.has(path.resolve(source).toLowerCase())) {
                continue;
            }
            known.add(path.resolve(source).toLowerCase());
            // Le fichier d'entrée dans les arguments doit suivre, sinon clangd
            // analyse le .ino.cpp et rapporte les erreurs au mauvais endroit.
            const args = entry.arguments.map((arg) => arg === entry.file ? source : arg);

            // « .ino » n'est une extension C++ que pour Arduino : clang la prend pour
            // un fichier objet à passer à l'éditeur de liens, et clangd abandonne sur
            // « expected exactly one compiler job ». `-x c++` lève l'ambiguïté, et doit
            // précéder le fichier — l'option ne vaut que pour ce qui la suit.
            const fileIndex = args.indexOf(source);
            if (fileIndex >= 0) {
                args.splice(fileIndex, 0, "-x", "c++");
            }

            result.push({ directory: entry.directory, arguments: args, file: source });
        }
    }

    // Les en-têtes du croquis profitent de la même configuration via clangd lui-même,
    // qui retombe sur l'entrée du fichier source le plus proche.
    return result;
}

/**
 * Base de compilation attendue par clangd. arduino-cli sait la produire lui-même
 * (`--only-compilation-database`), mais elle atterrit dans le dossier de construction :
 * clangd ne la cherche qu'à la racine du projet ou dans `build/`. On la recopie donc,
 * en y ajoutant au passage les entrées des `.ino` (voir addSketchEntries).
 *
 * @param sketchDir dossier contenant le `.ino` principal
 * @returns vrai si un fichier a été trouvé et recopié
 */
export function syncCompilationDatabase(rootPath: string, buildPath: string, sketchDir?: string): boolean {
    if (!rootPath || !buildPath) {
        return false;
    }
    const source = path.join(buildPath, constants.COMPILE_COMMANDS_FILE);
    if (!fs.existsSync(source)) {
        return false;
    }
    const target = path.join(rootPath, constants.COMPILE_COMMANDS_FILE);
    try {
        let entries = JSON.parse(fs.readFileSync(source, "utf8")) as ICompileCommand[];
        if (Array.isArray(entries) && sketchDir && fs.existsSync(sketchDir)) {
            entries = addSketchEntries(entries, rootPath, sketchDir);
        }
        const content = JSON.stringify(entries, null, 1);

        // clangd réindexe tout le projet à chaque écriture de ce fichier : ne le
        // réécrire que s'il change réellement.
        if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === content) {
            return true;
        }
        fs.writeFileSync(target, content, "utf8");
        return true;
    } catch (error) {
        arduinoChannel.warning(vscode.l10n.t("Unable to copy the \"{0}\" file: {1}",
            constants.COMPILE_COMMANDS_FILE, error.message));
        return false;
    }
}

/** La configuration clangd du projet est-elle déjà en place ? */
export function hasClangdConfig(rootPath?: string): boolean {
    const root = rootPath || ArduinoWorkspace.rootPath;
    if (!root) {
        return false;
    }
    return fs.existsSync(path.join(root, constants.COMPILE_COMMANDS_FILE));
}
