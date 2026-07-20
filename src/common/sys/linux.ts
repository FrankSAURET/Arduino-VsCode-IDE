// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as childProcess from "child_process";
import * as path from "path";
import { fileExistsSync } from "../util";

// Arduino IDE 2 embarque son propre arduino-cli dans ses ressources internes, sans
// l'exposer au PATH. Chemin relatif au dossier d'installation de l'IDE.
const IDE2_CLI_SUBPATH = path.join("resources", "app", "lib", "backend", "resources");

/**
 * Emplacements d'extraction habituels d'Arduino IDE 2 sous Linux.
 * Le format AppImage monte ses ressources dans un dossier temporaire imprévisible :
 * il n'est pas couvert ici, l'utilisateur devra renseigner « arduino.path ».
 */
function getIde2CliDirectories(): string[] {
    const roots = ["/opt", "/usr/local/share", "/usr/share"];
    if (process.env.HOME) {
        roots.push(path.join(process.env.HOME, ".local", "share"), process.env.HOME);
    }
    const dirNames = ["arduino-ide", "Arduino IDE"];
    const candidates: string[] = [];
    for (const root of roots) {
        for (const dirName of dirNames) {
            candidates.push(path.join(root, dirName, IDE2_CLI_SUBPATH));
        }
    }
    return candidates;
}

export function resolveArduinoPath(): string {
    let pathString;
    try {
        pathString = childProcess.execSync("readlink -f $(which arduino-cli)", { encoding: "utf8" });
        pathString = path.resolve(pathString).trim();
        if (fileExistsSync(pathString)) {
            pathString = path.dirname(path.resolve(pathString));
        }
    } catch (ex) {
        // Ignore the errors.
    }

    // Repli : CLI embarqué dans une installation d'Arduino IDE 2 (absent du PATH)
    if (!pathString) {
        pathString = getIde2CliDirectories().find((dir) => validateArduinoPath(dir)) || "";
    }

    return pathString || "";
}

export function validateArduinoPath(arduinoPath: string): boolean {
    return fileExistsSync(path.join(arduinoPath, "arduino-cli"));
}

export function findFile(fileName: string, cwd: string): string {
    let pathString;
    try {
        pathString = childProcess.execSync(`find ${cwd} -name ${fileName} -type f`, { encoding: "utf8" }).split("\n");

        if (pathString && pathString[0] && fileExistsSync(pathString[0].trim())) {
            pathString = path.normalize(pathString[0].trim());
        } else {
            pathString = null;
        }
    } catch (ex) {
        // Ignore the errors.
    }
    return pathString;
}
