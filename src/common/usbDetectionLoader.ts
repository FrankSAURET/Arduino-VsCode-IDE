// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Logger from "../logger/logger";

// Le binaire natif livre par usb-detection est compile pour une ABI Node figee
// (NODE_MODULE_VERSION 93). Charge sur un hote plus recent, il ne leve pas
// toujours une exception propre : il peut appeler abort(), ce qui tue l'hote
// d'extensions (code 134) hors de portee de tout try/catch. On refuse donc le
// chargement des que l'ABI ne correspond pas.
const USB_DETECTION_ABI = "93";

let cachedModule: any;
let loadAttempted = false;

/**
 * Charge usb-detection si et seulement si l'ABI native de l'hote correspond.
 * Renvoie undefined sinon. Le resultat est mis en cache : un seul chargement
 * par processus, quel que soit le nombre d'appelants.
 *
 * @param caller nom court de l'appelant, pour le journal.
 */
export function loadUsbDetection(caller: string): any {
    if (loadAttempted) {
        return cachedModule;
    }
    loadAttempted = true;

    if (process.versions.modules !== USB_DETECTION_ABI) {
        Logger.traceWarning(`${caller}AbiMismatch`, new Error(
            `usb-detection attend NODE_MODULE_VERSION ${USB_DETECTION_ABI}, `
            + `l'hote fournit ${process.versions.modules}. Detection USB desactivee.`));
        return undefined;
    }

    try {
        cachedModule = require("usb-detection");
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        Logger.traceWarning(`${caller}RequireFailed`, normalizedError);
        cachedModule = undefined;
    }

    return cachedModule;
}
