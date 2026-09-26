// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as vscode from "vscode";

import { ISerialPortDetail, listSerialPorts } from "../common/portList";
import { DeviceContext } from "../deviceContext";

/**
 * Contrôle du port série avant un téléversement.
 *
 * Un port vide, périmé (carte débranchée, autre numéro COM) ou inventé laissait
 * avrdude tenter dix synchronisations pendant une vingtaine de secondes avant
 * d'échouer, sans message clair ni moyen d'annuler.
 */

/** Motifs d'interruption d'un téléversement (valeurs de SpawnAbort.reason). */
export enum UploadAbort {
    Cancelled = "cancelled",
    NotResponding = "notResponding",
}

export interface IUploadPortCheck {
    /** ok : port utilisable ; missing : aucun port choisi ; absent : port choisi mais non branché. */
    status: "ok" | "missing" | "absent";
    /** Seul port USB présent, proposé d'office quand le port choisi est vide ou absent. */
    candidate?: string;
}

/** Un téléversement par ST-Link passe par la sonde, pas par un port série. */
export function uploadNeedsSerialPort(configuration: string | undefined): boolean {
    return !configuration || !/upload_method=[^=,]*st[^,]*link/i.test(configuration);
}

/**
 * Premier signe qu'avrdude parle dans le vide : inutile d'attendre les neuf autres tentatives.
 * Couvre stk500 (Uno, Nano…) et stk500v2 (Mega), anciennes et nouvelles tournures d'avrdude.
 */
export function isBoardNotRespondingLine(line: string): boolean {
    return /not in sync|programmer is not responding/i.test(line);
}

/**
 * Le port désigne-t-il un périphérique série local ? Une adresse réseau (téléversement OTA
 * d'un ESP32) ne figure jamais dans la liste des ports série : c'est à arduino-cli d'en juger.
 */
function isSerialDevicePath(port: string): boolean {
    return /^(\\\\\.\\)?COM\d+$/i.test(port) || port.startsWith("/dev/");
}

/** Forme comparable d'un port : COM insensible à la casse, lien symbolique /dev résolu. */
function canonicalPort(port: string): string {
    const com = /^(?:\\\\\.\\)?(COM\d+)$/i.exec(port);
    if (com) {
        return com[1].toUpperCase();
    }
    if (port.startsWith("/dev/")) {
        // /dev/serial/by-id/… est un lien stable vers /dev/ttyACM0, seul nom que liste serialport.
        try {
            return fs.realpathSync(port);
        } catch {
            return port;
        }
    }
    return port;
}

/**
 * @param port port inscrit dans arduino.yaml
 * @param ports ports présents (même source que le sélecteur de port), undefined si la liste
 *  n'a pas pu être lue : on ne bloque alors pas un port renseigné.
 */
export function checkUploadPort(port: string | undefined, ports: ISerialPortDetail[] | undefined): IUploadPortCheck {
    if (port && (!ports || !isSerialDevicePath(port))) {
        return { status: "ok" };
    }
    const wanted = port ? canonicalPort(port) : "";
    if (port && ports.some((p) => canonicalPort(p.port) === wanted)) {
        return { status: "ok" };
    }
    // Les ports sans VID/PID (COM1 de la carte mère, Bluetooth) ne sont jamais une carte Arduino.
    const usbPorts = (ports || []).filter((p) => p.vendorId && p.productId);
    return {
        status: port ? "absent" : "missing",
        candidate: usbPorts.length === 1 ? usbPorts[0].port : undefined,
    };
}

/** Interactions nécessaires à ensureUploadPort, séparées pour pouvoir les simuler en test. */
export interface IUploadPortUi {
    getPort(): string | undefined;
    setPort(port: string): void;
    /** undefined si la liste des ports n'a pas pu être lue. */
    listPorts(): Promise<ISerialPortDetail[] | undefined>;
    /** Fenêtre modale ; renvoie le bouton choisi, undefined si fermée. */
    ask(message: string, buttons: string[]): Promise<string | undefined>;
    /** Ouvre le sélecteur de port ; renvoie le port choisi (déjà enregistré), undefined si abandon. */
    pickPort(): Promise<string | undefined>;
}

/**
 * Garantit un port branché avant de lancer arduino-cli.
 * @returns le port à utiliser, ou undefined si l'utilisateur a renoncé : ne rien lancer.
 */
export async function ensureUploadPort(ui: IUploadPortUi): Promise<string | undefined> {
    // Chaque tour attend une action de l'utilisateur ; la borne évite seulement de boucler
    // sans fin si le port choisi disparaît aussitôt de la liste.
    for (let round = 0; round < 5; round++) {
        const port = ui.getPort();
        const check = checkUploadPort(port, await ui.listPorts());
        if (check.status === "ok") {
            return port;
        }
        const message = check.status === "missing"
            ? vscode.l10n.t("No serial port selected for upload.")
            : vscode.l10n.t("Port {0} is not connected.", port);
        const selectAction = vscode.l10n.t("Select a port");
        const uploadToAction = check.candidate ? vscode.l10n.t("Upload to {0}", check.candidate) : undefined;
        const choice = await ui.ask(message, uploadToAction ? [uploadToAction, selectAction] : [selectAction]);
        if (uploadToAction && choice === uploadToAction) {
            ui.setPort(check.candidate);
            return check.candidate;
        }
        if (choice !== selectAction || !await ui.pickPort()) {
            return undefined;
        }
        // Port choisi : le tour suivant le contrôle à nouveau puis poursuit le téléversement.
    }
    return undefined;
}

/**
 * Sélecteur de port (commande arduino.selectSerialPort).
 * @returns le port choisi, déjà inscrit dans arduino.yaml ; undefined si abandon.
 */
export async function selectSerialPort(): Promise<string | undefined> {
    const ports = await listSerialPorts();
    if (!ports.length) {
        vscode.window.showInformationMessage(vscode.l10n.t("No serial port is available."));
        return undefined;
    }
    const chosen = await vscode.window.showQuickPick(
        ports.map((p) => ({ label: p.port, description: p.desc }))
             .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
        { placeHolder: vscode.l10n.t("Select a serial port") },
    );
    if (!chosen) {
        return undefined;
    }
    DeviceContext.getInstance().port = chosen.label;
    return chosen.label;
}

/** Interactions réelles : fenêtres modales de VS Code et port du projet courant. */
export function vscodeUploadPortUi(): IUploadPortUi {
    const dc = DeviceContext.getInstance();
    return {
        getPort: () => dc.port,
        setPort: (port) => { dc.port = port; },
        listPorts: () => listSerialPorts().catch((): ISerialPortDetail[] => undefined),
        ask: async (message, buttons) => vscode.window.showWarningMessage(message, { modal: true }, ...buttons),
        pickPort: selectSerialPort,
    };
}

/** Message d'avrdude sans réponse de la carte ; propose de changer de port. */
export async function askAfterNoResponse(port: string, ui: IUploadPortUi = vscodeUploadPortUi()): Promise<boolean> {
    const selectAction = vscode.l10n.t("Select a port");
    const choice = await ui.ask(
        vscode.l10n.t("The board is not responding on {0}: check the port and the selected board.", port),
        [selectAction]);
    return choice === selectAction && !!await ui.pickPort();
}
