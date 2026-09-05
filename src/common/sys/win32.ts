// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as childProcess from "child_process";
import * as path from "path";
import { promisify } from "util";
import { fileExistsSync } from "../util";

const execFileAsync = promisify(childProcess.execFile);

// Arduino IDE 2 embarque son propre arduino-cli dans ses ressources internes, sans
// l'exposer au PATH. Chemin relatif au dossier d'installation de l'IDE.
const IDE2_CLI_SUBPATH = path.join("resources", "app", "lib", "backend", "resources");

/**
 * Emplacements d'installation habituels d'Arduino IDE 2 sous Windows :
 * installation "pour tous les utilisateurs" (Program Files) ou "pour moi" (LOCALAPPDATA).
 */
function getIde2CliDirectories(): string[] {
    const roots = [
        process.env.ProgramFiles,
        process.env["ProgramFiles(x86)"],
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : undefined,
    ];
    return roots
        .filter((root) => !!root)
        .map((root) => path.join(root, "Arduino IDE", IDE2_CLI_SUBPATH));
}

export async function resolveArduinoPath() {
    let pathString = "";
    try {
        // "where" peut renvoyer plusieurs résultats (un par ligne) : ne garder que le premier
        // Jamais en execSync : un appel synchrone fige la boucle d'evenements de l'hote
        // d'extensions ; si "where" traine (PATH long, disque charge, antivirus), l'hote
        // ne repond plus au signal de vie et VS Code le tue (code 134).
        const { stdout: whereOutput } = await execFileAsync("where", ["arduino-cli"], {
            encoding: "utf8",
            timeout: 5000,
            windowsHide: true,
        });
        const firstMatch = whereOutput.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) || "";
        if (firstMatch && fileExistsSync(firstMatch)) {
            pathString = path.dirname(path.resolve(firstMatch));
        }
    } catch (error) {
        // Ignore the errors.
    }

    // Repli : CLI embarqué dans une installation d'Arduino IDE 2 (absent du PATH)
    if (!pathString) {
        pathString = getIde2CliDirectories().find((dir) => validateArduinoPath(dir)) || "";
    }

    return pathString || "";
}

export function validateArduinoPath(arduinoPath: string): boolean {
    return fileExistsSync(path.join(arduinoPath, "arduino-cli.exe"));
}

export function findFile(fileName: string, cwd: string): string {
    let result;
    try {
        const pathString = childProcess.execSync(`dir ${fileName} /S /B`, { encoding: "utf8", cwd }).split("\n");
        if (pathString && pathString[0] && fileExistsSync(pathString[0].trim())) {
            result = path.normalize(pathString[0].trim());
        }
    } catch (ex) {
        // Ignore the errors.
    }
    return result;
}
