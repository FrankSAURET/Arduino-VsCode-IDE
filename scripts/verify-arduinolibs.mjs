// Bibliotheque Arduino manquante (« Servo.h: No such file or directory ») sur
// un poste equipe par la seule extension (sans Arduino IDE 2) : l'extension
// doit reconnaitre l'en-tete manquant, retrouver la bibliotheque qui le
// fournit et proposer de l'installer.
//
// A. Fonctions pures de src/arduino/arduinoLibs.ts (reconnaissance, classement).
// B. Vraie recherche dans l'index Arduino, si un arduino-cli est sur le poste
//    (ARDUINO_DIRECTORIES_USER = dossier temporaire du scratchpad : le carnet
//    de croquis courant n'est pas touche).
// C. Cablage dans environmentSetup.ts et arduino.ts (installation initiale du
//    lot, bouton apres une erreur de compilation).
// D. Traductions FR presentes.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'arduino-vscode-libs-'));

let ok = 0;
const fails = [];
const check = (cond, label, detail = '') => {
    if (cond) {
        ok++;
    } else {
        fails.push(label);
        console.log(`  x ${label}${detail ? ` - ${detail}` : ''}`);
    }
};

// Transpile un .ts du projet en .js CommonJS dans le dossier temporaire, en
// respectant son chemin relatif par rapport a `src/` (pour que les `require('../…')`
// generes retrouvent leurs voisins, eux aussi transpiles).
function transpileToTemp(relFromSrc) {
    const src = readFileSync(join(ROOT, 'src', relFromSrc), 'utf8');
    const js = ts.transpileModule(src, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2019,
            esModuleInterop: true,
        },
    }).outputText;
    const out = join(tmp, relFromSrc).replace(/\.ts$/, '.js');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, js);
    return out;
}

transpileToTemp('common/cliEnv.ts');
const libsPath = transpileToTemp('arduino/arduinoLibs.ts');
const libs = await import(pathToFileURL(libsPath).href);

console.log('A. Reconnaissance de l\'en-tete manquant :');
const sortieServo =
    'C:\\eleve\\servo-uno\\servo-uno.ino:1:10: fatal error: Servo.h: No such file or directory\n' +
    ' #include <Servo.h>\n          ^~~~~~~~~\ncompilation terminated.\n';
check(libs.enTeteManquant(sortieServo) === 'Servo.h', 'Servo.h reconnu', libs.enTeteManquant(sortieServo));
check(
    libs.enTeteManquant('x.ino:2:10: fatal error: Adafruit_NeoPixel.h: No such file or directory') === 'Adafruit_NeoPixel.h',
    'en-tete avec soulignes',
);
check(
    libs.enTeteManquant('x.ino:3:10: fatal error: utility/foo.hpp: No such file or directory') === 'foo.hpp',
    'chemin dans l\'include : dernier segment, .hpp',
);
check(libs.enTeteManquant("x.ino:12:5: error: 'digitalWrit' was not declared") === undefined, 'erreur de code : rien');

console.log('\nB. Classement des candidats :');
const index = [
    { name: 'ESP32Servo', latest: { architectures: ['esp32'], provides_includes: ['ESP32Servo.h'] } },
    { name: 'SlowMotionServo', latest: { architectures: ['*'], provides_includes: ['SlowMotionServo.h', 'Servo.h'] } },
    { name: 'Servo', latest: { architectures: ['avr', 'sam'], types: ['Arduino'], version: '1.3.0' } },
    { name: 'ServoEasing', latest: { architectures: ['*'] } },
];
const c = libs.classerCandidats('Servo.h', index);
check(c[0]?.nom === 'Servo', 'Servo officielle en tete', JSON.stringify(c.map((x) => x.nom)));
check(!c.some((x) => x.nom === 'ESP32Servo'), 'bibliotheque non AVR ecartee');
check(!c.some((x) => x.nom === 'ServoEasing'), 'nom voisin sans l\'en-tete ecarte');
check(libs.candidatEvident(c)?.nom === 'Servo', 'Servo installee sans faire choisir');
check(
    libs.candidatEvident(libs.classerCandidats('Servo.h', [index[1]])) === undefined,
    'simple « provides » : on fait choisir',
);
check(libs.termeDeRecherche('Adafruit_NeoPixel.h') === 'Adafruit NeoPixel', 'terme de recherche sans soulignes');
check(libs.termeDeRecherche('DHT.h') === 'DHT sensor library', 'DHT.h -> DHT sensor library');
const dht = libs.classerCandidats('DHT.h', [
    { name: 'DHTlib', latest: { architectures: ['avr'], provides_includes: ['dht.h'] } },
    { name: 'DHT sensor library', latest: { architectures: ['*'] } },
]);
check(libs.candidatEvident(dht)?.nom === 'DHT sensor library', 'correspondance connue prioritaire');
check(
    libs.candidatEvident(
        libs.classerCandidats('LiquidCrystal_I2C.h', [{ name: 'LiquidCrystal I2C', latest: { architectures: ['avr'] } }]),
    )?.nom === 'LiquidCrystal I2C',
    'LiquidCrystal_I2C.h -> « LiquidCrystal I2C »',
);

// Bibliotheques de base (Arduino IDE 2 les pose au premier lancement via la
// meta `Arduino_BuiltIn`, arduino-cli jamais) : un de leurs en-tetes installe
// tout le lot.
check(libs.BIBLIOTHEQUES_DE_BASE === 'Arduino_BuiltIn', 'lot de base : Arduino_BuiltIn');
for (const h of ['Servo.h', 'servo.h', 'Stepper.h', 'LiquidCrystal.h', 'SD.h']) {
    check(libs.fourniParLaBase(h), `${h} fourni par le lot de base`);
}
for (const h of ['LiquidCrystal_I2C.h', 'Adafruit_NeoPixel.h', 'ESP32Servo.h', 'DHT.h']) {
    check(!libs.fourniParLaBase(h), `${h} hors du lot de base`);
}

check(libs.lotDeBaseComplet(['Servo', 'Stepper', 'LiquidCrystal', 'Ethernet', 'Keyboard', 'Mouse', 'TFT', 'SD', 'Firmata']),
    'lot complet reconnu');
check(!libs.lotDeBaseComplet(['Servo', 'Stepper']), 'lot incomplet non reconnu');
check(!libs.lotDeBaseComplet([]), 'lot vide : non reconnu');
check(libs.lotDeBaseComplet(['servo', 'STEPPER', 'liquidcrystal', 'ethernet', 'keyboard', 'mouse', 'tft', 'sd', 'firmata']),
    'casse ignoree');

console.log('\nC. Vraie recherche dans l\'index Arduino :');
async function trouverCli() {
    // Priorite au CLI telecharge par l'extension pour cette installation,
    // puis au CLI du PATH systeme.
    const candidats = [];
    const extensionCli = join(ROOT, 'arduino-cli', process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
    candidats.push(extensionCli);
    candidats.push(process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
    for (const c of candidats) {
        try {
            await execFileAsync(c, ['version'], { timeout: 5000 });
            return c;
        } catch { /* on continue */ }
    }
    return '';
}
const cliPath = await trouverCli();
if (!cliPath) {
    console.log('  (arduino-cli absent de ce poste : partie sautee)');
} else {
    // Dossier temporaire du scratchpad : n'ecrit pas dans le carnet de l'utilisateur.
    const sandbox = mkdtempSync(join(tmpdir(), 'arduino-vscode-sandbox-'));
    process.env.ARDUINO_DIRECTORIES_USER = sandbox;
    process.env.ARDUINO_DIRECTORIES_DATA = sandbox;
    try {
        for (const [h, attendu] of [
            ['Servo.h', 'Servo'],
            ['Adafruit_NeoPixel.h', 'Adafruit NeoPixel'],
            ['LiquidCrystal_I2C.h', 'LiquidCrystal I2C'],
            ['DHT.h', 'DHT sensor library'],
        ]) {
            const r = await libs.chercherBibliotheques(cliPath, h);
            check(
                libs.candidatEvident(r)?.nom === attendu,
                `${h} -> ${attendu}`,
                JSON.stringify(r.slice(0, 3).map((x) => x.nom)),
            );
        }
        // listeInstallees : lot vide dans un carnet neuf
        const installees = await libs.listeInstallees(cliPath);
        check(Array.isArray(installees), 'listeInstallees renvoie un tableau', String(installees));
        check(installees && !libs.lotDeBaseComplet(installees), 'carnet neuf : lot de base incomplet');
    } catch (err) {
        console.log(`  (index Arduino inaccessible : partie sautee - ${String(err).split('\n')[0]})`);
    }
}

console.log('\nD. Cablage dans environnement et compilateur :');
const envSetup = readFileSync(join(ROOT, 'src/arduino/environmentSetup.ts'), 'utf8');
check(/lib.*install.*BIBLIOTHEQUES_DE_BASE/.test(envSetup) || /"lib", "install", BIBLIOTHEQUES_DE_BASE/.test(envSetup),
    'setupEnvironment : installation d\'Arduino_BuiltIn');
check(/listeInstallees\(commandPath\)/.test(envSetup), 'setupEnvironment : etat des bibliotheques installees');
check(/hasBuiltInLibraries/.test(envSetup), 'IEnvironmentStatus : champ hasBuiltInLibraries');
check(/promptSetupEnvironment[\s\S]+hasBuiltInLibraries/.test(envSetup),
    'promptSetupEnvironment : tient compte du lot de base');

const arduinoTs = readFileSync(join(ROOT, 'src/arduino/arduino.ts'), 'utf8');
check(/enTeteManquant\(this\._lastCompileOutput\)/.test(arduinoTs), 'arduino.ts : on cherche l\'en-tete manquant');
check(/_offerMissingLibraryInstall/.test(arduinoTs), 'arduino.ts : offre d\'installation definie');
check(/fourniParLaBase\(header\)[\s\S]{0,800}BIBLIOTHEQUES_DE_BASE/.test(arduinoTs),
    'arduino.ts : en-tete de base -> tout le lot Arduino_BuiltIn');
check(/_libraryRetryRequested\s*=\s*true/.test(arduinoTs), 'arduino.ts : relance apres installation');

console.log('\nE. Traductions FR :');
const fr = JSON.parse(readFileSync(join(ROOT, 'l10n/bundle.l10n.fr.json'), 'utf8'));
check(fr['Install the library'] === 'Installer la bibliothèque', 'bouton « Install the library » traduit');
check(typeof fr['The library that provides {0} is not installed on this computer.'] === 'string',
    'message « bibliothèque introuvable » traduit');
check(typeof fr['Installing the {0} library bundle (Servo, Stepper, LiquidCrystal, Ethernet, SD, Keyboard, Mouse, TFT, Firmata)...'] === 'string',
    'message « installation du lot de base » traduit');
check(typeof fr['The Arduino base libraries (Servo, Stepper, LiquidCrystal…) are not installed. Without them, many sketches will not compile. Install the {0} library bundle now?'] === 'string',
    'parcours : offre d\'installation du lot de base traduite');

console.log(`\n${ok} controles verts, ${fails.length} rouge(s).`);
console.log(fails.length ? 'RESULTAT: ECHEC' : 'RESULTAT: OK');
process.exit(fails.length ? 1 : 0);
