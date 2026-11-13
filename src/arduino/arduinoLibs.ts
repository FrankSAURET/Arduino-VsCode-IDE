// Copyright (c) electropol-fr. All rights reserved.
// Licensed under the MIT license.

/**
 * Bibliotheque Arduino manquante : la reconnaitre dans la sortie du compilateur,
 * retrouver dans l'index Arduino la bibliotheque qui fournit l'en-tete, et
 * l'installer avec le meme arduino-cli que celui qui compile.
 *
 * Origine (Frank, 13/11/2026) : certains postes equipes par la seule extension
 * (pas d'Arduino IDE 2 installe) butaient sur « Servo.h: No such file or
 * directory ». Servo n'est PAS dans le coeur `arduino:avr` : Arduino IDE 2
 * l'installe au premier lancement, pour chaque utilisateur, via la meta
 * `Arduino_BuiltIn` (`lib install Arduino_BuiltIn` tire les neuf en
 * dependances). arduino-cli seul ne l'a jamais fait.
 *
 * Les fonctions de reconnaissance et de classement sont PURES (testees par
 * scripts/verify-arduinolibs.mjs) ; seules `chercherBibliotheques`,
 * `installerBibliotheque` et `listeInstallees` lancent arduino-cli.
 *
 * Portage du module `arduinoLibs` de Kablix (v2026.11.2.310), adapte au style
 * de ce projet : indentation 4 espaces, environnement du CLI pris via cliEnv()
 * pour couper les sorties de telemetrie.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { cliEnv } from "../common/cliEnv";

const execFileAsync = promisify(execFile);

// gcc : « servo-uno.ino:1:10: fatal error: Servo.h: No such file or directory ».
// avr-gcc reste en anglais quelle que soit la langue du systeme.
const EN_TETE_MANQUANT = /fatal error:\s*([^\s:]+\.(?:h|hh|hpp|hxx)):\s*No such file or directory/i;

/** En-tete introuvable (« Servo.h ») cite par le compilateur, ou undefined. */
export function enTeteManquant(sortie: string): string | undefined {
    const m = EN_TETE_MANQUANT.exec(sortie);
    // `#include <dossier/x.h>` : seul le dernier segment sert a la recherche.
    return m ? m[1].split(/[\\/]/).pop() : undefined;
}

/**
 * En-tetes dont la bibliotheque porte un nom SANS rapport avec le fichier :
 * la recherche par nom ne les trouverait pas. Seulement des cas courants en
 * classe et verifies dans l'index Arduino — le reste passe par le classement.
 */
export const BIBLIOTHEQUE_DE: Readonly<Record<string, string>> = {
    "dht.h": "DHT sensor library",
    "dht_u.h": "DHT sensor library",
    "adafruit_sensor.h": "Adafruit Unified Sensor",
    "adafruit_gfx.h": "Adafruit GFX Library",
    "u8g2lib.h": "U8g2",
    "u8x8lib.h": "U8g2",
};

/**
 * Bibliotheques « de base » d'Arduino. Arduino IDE 2 les installe au premier
 * lancement en posant la meta-bibliotheque `Arduino_BuiltIn`, qui les tire
 * toutes en dependances. Pour un de ces en-tetes, on pose tout le lot d'un
 * coup : le Stepper.h de la seance suivante est deja la.
 */
export const BIBLIOTHEQUES_DE_BASE = "Arduino_BuiltIn";
const EN_TETES_DE_BASE = new Set([
    "servo.h", "stepper.h", "liquidcrystal.h", "ethernet.h", "keyboard.h",
    "mouse.h", "tft.h", "sd.h", "firmata.h",
]);

/** Noms des bibliotheques installees par la meta `Arduino_BuiltIn`. */
export const NOMS_DE_BASE = [
    "Servo", "Stepper", "LiquidCrystal", "Ethernet", "Keyboard",
    "Mouse", "TFT", "SD", "Firmata",
];

/** Vrai si l'en-tete est fourni par le lot `Arduino_BuiltIn`. */
export function fourniParLaBase(enTete: string): boolean {
    return EN_TETES_DE_BASE.has(enTete.toLowerCase());
}

/** Bibliotheque telle que la decrit `arduino-cli lib search --format json`. */
export interface BibliothequeIndex {
    name: string;
    latest?: {
        version?: string;
        author?: string;
        sentence?: string;
        types?: string[];
        architectures?: string[];
        provides_includes?: string[];
    };
}

/** Candidat retenu, avec son score (plus haut = plus probable). */
export interface Candidat {
    nom: string;
    version?: string;
    auteur?: string;
    phrase?: string;
    score: number;
}

/** « Adafruit_NeoPixel » et « Adafruit NeoPixel » se valent. */
const normaliser = (s: string): string => s.toLowerCase().replace(/[\s_\-.]+/g, "");

/** Nom de fichier sans extension : « Servo.h » → « Servo ». */
const racine = (enTete: string): string => enTete.replace(/\.[^.]+$/, "");

/** Terme passe a `arduino-cli lib search` pour un en-tete donne. */
export function termeDeRecherche(enTete: string): string {
    return BIBLIOTHEQUE_DE[enTete.toLowerCase()] ?? racine(enTete).replace(/_/g, " ");
}

/**
 * Classe les bibliotheques de l'index pour un en-tete : ne garde que celles qui
 * le fournissent vraisemblablement ET qui tournent sur AVR (cette extension ne
 * compile que pour une carte reelle, souvent Uno/Nano/Mega), la meilleure en
 * tete.
 */
export function classerCandidats(enTete: string, index: BibliothequeIndex[]): Candidat[] {
    const h = enTete.toLowerCase();
    const nomConnu = BIBLIOTHEQUE_DE[h];
    const cle = normaliser(racine(enTete));
    const out: Candidat[] = [];
    for (const lib of index) {
        const r = lib.latest ?? {};
        const archis = (r.architectures ?? ["*"]).map((a) => a.toLowerCase());
        if (!archis.includes("*") && !archis.includes("avr")) { continue; }
        let score = 0;
        if (nomConnu && lib.name.toLowerCase() === nomConnu.toLowerCase()) { score += 100; }
        if (normaliser(lib.name) === cle) { score += 80; }
        if ((r.provides_includes ?? []).some((p) => p.toLowerCase() === h)) { score += 50; }
        if (score === 0) { continue; }
        // Depart : bibliotheque officielle Arduino d'abord.
        if ((r.types ?? []).includes("Arduino")) { score += 10; }
        out.push({ nom: lib.name, version: r.version, auteur: r.author, phrase: r.sentence, score });
    }
    return out.sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom));
}

/**
 * Vrai si le premier candidat s'impose (nom exact ou correspondance connue, sans
 * ex aequo) : on l'installe sans faire choisir l'utilisateur.
 */
export function candidatEvident(candidats: Candidat[]): Candidat | undefined {
    const [a, b] = candidats;
    if (!a || a.score < 80) { return undefined; }
    return !b || b.score < a.score ? a : undefined;
}

async function cli(chemin: string, args: string[]): Promise<string> {
    try {
        const { stdout } = await execFileAsync(chemin, args, {
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            env: cliEnv(),
            windowsHide: true,
        });
        return stdout;
    } catch (err) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        throw new Error([e.stderr, e.stdout].filter((s) => s?.trim()).join("\n") || e.message || String(err));
    }
}

/**
 * Cherche dans l'index Arduino les bibliotheques qui fournissent `enTete`.
 * Index vide ou jamais telecharge (poste neuf) : on le met a jour une fois.
 */
export async function chercherBibliotheques(cheminCli: string, enTete: string): Promise<Candidat[]> {
    const chercher = async (): Promise<BibliothequeIndex[]> => {
        const sortie = await cli(cheminCli, [
            "lib", "search", termeDeRecherche(enTete), "--format", "json", "--omit-releases-details",
        ]);
        return (JSON.parse(sortie || "{}") as { libraries?: BibliothequeIndex[] }).libraries ?? [];
    };
    let index: BibliothequeIndex[] = [];
    try {
        index = await chercher();
    } catch {
        index = [];
    }
    if (index.length === 0) {
        await cli(cheminCli, ["lib", "update-index"]);
        index = await chercher();
    }
    return classerCandidats(enTete, index);
}

/**
 * Installe une bibliotheque (et ses dependances) dans le carnet de croquis.
 * Index jamais telecharge (poste neuf) : `lib install` ne trouve rien, on le
 * met a jour puis on reessaie une fois.
 */
export async function installerBibliotheque(cheminCli: string, nom: string): Promise<void> {
    try {
        await cli(cheminCli, ["lib", "install", nom]);
    } catch {
        await cli(cheminCli, ["lib", "update-index"]);
        await cli(cheminCli, ["lib", "install", nom]);
    }
}

/**
 * Liste les bibliotheques installees telles que `arduino-cli lib list` les
 * decrit. Retourne null quand le CLI ne repond pas (indetermine), un tableau
 * eventuellement vide sinon.
 */
export async function listeInstallees(cheminCli: string): Promise<string[] | null> {
    const parse = (brut: string): string[] => {
        const parsed = JSON.parse(brut || "{}");
        // Selon la version du CLI : { installed_libraries: [...] } ou directement un tableau.
        const items = Array.isArray(parsed) ? parsed : (parsed.installed_libraries || parsed.libraries || []);
        return items
            .map((e: any) => e?.library?.name || e?.name || "")
            .filter((s: string) => !!s);
    };
    try {
        return parse(await cli(cheminCli, ["lib", "list", "--format", "json"]));
    } catch {
        try {
            return parse(await cli(cheminCli, ["lib", "list", "--json"]));
        } catch {
            return null;
        }
    }
}

/**
 * Vrai si les bibliotheques de base d'Arduino sont presentes (la meta
 * `Arduino_BuiltIn` ou chacune a la main). Un seul manquant rend la fonction
 * fausse : l'installation du lot rattrapera tout le monde. Null si le CLI n'a
 * pas repondu (indetermine) — l'appelant ne doit pas conclure a une absence.
 */
export function lotDeBaseComplet(installees: string[]): boolean {
    const presents = new Set(installees.map((n) => n.toLowerCase()));
    return NOMS_DE_BASE.every((n) => presents.has(n.toLowerCase()));
}
