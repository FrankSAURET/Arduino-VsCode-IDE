// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as winston from "winston";
import UserNotificationTransport from "./user-notification-transport";

export enum LogLevel {
    Info = "info",
    Warn = "warn",
    Error = "error",
}

function FilterErrorPath(line: string): string {
    if (line) {
        const values: string[] = line.split("/out/");
        if (values.length <= 1) {
            // Didn't match expected format
            return line;
        } else {
            return values[1];
        }
    }
}

/**
 * Emplacement du journal : le dossier de donnees de l'extension, jamais le dossier
 * de l'extension elle-meme.
 *
 * Winston garde le descripteur ouvert tant que l'extension vit. Sous Windows, un
 * fichier ouvert ne s'efface pas : ecrit dans le dossier de l'extension, il
 * empechait VS Code de supprimer ce dossier a la desinstallation. Celle-ci restait
 * a moitie faite — entree retiree du registre, dossier toujours la — et la
 * reinstallation tournait longuement avant d'abandonner sans rien poser.
 *
 * Repli sur le dossier de l'extension si le dossier de donnees est indisponible :
 * mieux vaut le defaut d'origine qu'aucun journal.
 */
function resolveLogFile(context: vscode.ExtensionContext): string {
    const storagePath = context.globalStorageUri?.fsPath;
    if (storagePath) {
        try {
            fs.mkdirSync(storagePath, { recursive: true });
            return path.join(storagePath, "arduino.log");
        } catch (error) {
            // Dossier de donnees inaccessible : on retombe sur le comportement d'origine.
        }
    }
    return context.asAbsolutePath("arduino.log");
}

export function configure(context: vscode.ExtensionContext) {
    winston.configure({
        transports: [
            new (winston.transports.File)({ level: LogLevel.Warn, filename: resolveLogFile(context) }),
            new UserNotificationTransport({ level: LogLevel.Info }),
        ],
    });
}

export function info(message: string, metadata?: any) {
    winston.info(message, metadata);
}

export function debug(message: string, metadata?: any) {
    winston.debug(message, metadata);
}

export function warn(message: string, metadata?: any) {
    winston.warn(message, metadata);
}

export function verbose(message: string, metadata?: any) {
    winston.verbose(message, metadata);
}

export function error(message: string, metadata?: any) {
    winston.error(message, metadata);
}

export function silly(message: string, metadata?: any) {
    winston.silly(message, metadata);
}

export function traceUserData(message: string, metadata?: any) {
    winston.log(LogLevel.Info, message, metadata);
}

function traceErrorOrWarning(level: string, message: string, error: Error, metadata?: any) {
    // use `info` as the log level and add a special flag in metadata
    let stackArray: string[];
    let firstLine: string = "";
    if (error !== undefined && error.stack !== undefined) {
        stackArray = error.stack.split("\n");
        if (stackArray !== undefined && stackArray.length >= 2) {
            firstLine = stackArray[1]; // The fist line is the error message and we don't want to send that telemetry event
            firstLine = FilterErrorPath(firstLine ? firstLine.replace(/\\/g, "/") : "");
        }
    }
    winston.log(level, message, { ...metadata, message: error.message, errorLine: firstLine });
}

export function traceError(message: string, error: Error, metadata?: any) {
    traceErrorOrWarning(LogLevel.Error, message, error, metadata);
}

export function traceWarning(message: string, error: Error, metadata?: any) {
    traceErrorOrWarning(LogLevel.Warn, message, error, metadata);
}

export function notifyAndThrowUserError(errorCode: string, error: Error, message?: string) {
    notifyUserError(errorCode, error, message);
    throw error;
}

export function notifyUserError(errorCode: string, error: Error, message?: string) {
    traceError(errorCode, error, { notification: message || error.message, showUser: true });
}

export function notifyUserWarning(errorCode: string, error: Error, message?: string) {
    traceWarning(errorCode, error, { notification: message || error.message, showUser: true });
}

export class Timer {
    private _startTime: [number, number];

    constructor() {
        this.start();
    }

    // Get the duration of time elapsed by the timer, in milliseconds
    public end(): number {
        if (!this._startTime) {
            return -1;
        } else {
            const endTime = process.hrtime(this._startTime);
            return endTime[0] * 1000 + endTime[1] / 1000000;
        }
    }

    public start(): void {
        this._startTime = process.hrtime();
    }
}
