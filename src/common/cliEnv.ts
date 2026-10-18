// Copyright (c) electropol-fr. All rights reserved.
// Licensed under the MIT license.

/**
 * Environnement des appels à arduino-cli.
 *
 * Le CLI lit toute clef de configuration dans une variable `ARDUINO_<CLEF>` (points → soulignés).
 * On coupe ici ses deux sorties facultatives, sans toucher au fichier arduino-cli.yaml de l'utilisateur :
 * - `metrics.enabled` : mesures d'usage anonymes ;
 * - `updater.enable_notification` : interrogation de downloads.arduino.cc pour signaler une nouvelle version.
 * Les index de cartes et de bibliothèques, eux, restent téléchargés : sans eux le CLI ne sert à rien.
 */
export const CLI_PRIVACY_ENV: NodeJS.ProcessEnv = {
    ARDUINO_METRICS_ENABLED: "false",
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: "false",
};

/** Environnement de base (par défaut celui du processus) complété par les réglages de confidentialité. */
export function cliEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    return { ...base, ...CLI_PRIVACY_ENV };
}
