// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as childProcess from "child_process";
import * as path from "path";
import { fileExistsSync } from "../util";

// Arduino IDE 2 embarque son propre arduino-cli dans le bundle applicatif, sans
// l'exposer au PATH.
const IDE2_CLI_SUBPATH = path.join("Contents", "Resources", "app", "lib", "backend", "resources");

/**
 * Emplacements d'installation habituels d'Arduino IDE 2 sous macOS :
 * /Applications (tous les utilisateurs) ou ~/Applications (utilisateur courant).
 */
function getIde2CliDirectories(): string[] {
    const roots = ["/Applications"];
    if (process.env.HOME) {
        roots.push(path.join(process.env.HOME, "Applications"));
    }
    return roots.map((root) => path.join(root, "Arduino IDE.app", IDE2_CLI_SUBPATH));
}

export function resolveArduinoPath(): string {
    let pathString;
    try {
        pathString = childProcess.execSync("which arduino-cli", { encoding: "utf8" });
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
