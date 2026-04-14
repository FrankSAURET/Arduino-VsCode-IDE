// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as childProcess from "child_process";
import * as path from "path";
import { fileExistsSync } from "../util";

export async function resolveArduinoPath() {
    let pathString = "";
    try {
        pathString = childProcess.execSync("where arduino-cli", { encoding: "utf8" });
        pathString = path.resolve(pathString).trim();
        if (fileExistsSync(pathString)) {
            pathString = path.dirname(path.resolve(pathString));
        }
    } catch (error) {
        // Ignore the errors.
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
