/**
 * Construit le .vsix avec, dans son nom, la version publique ET le numéro de build.
 * Usage : npm run package
 *
 * Nom produit, à la racine du projet : arduino-vscode-ide-<buildNumber>.vsix
 * ex. : arduino-vscode-ide-2026.9.1.23.vsix
 *
 * Ne publie jamais : appelle uniquement « vsce package ».
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifeste = JSON.parse(readFileSync(path.join(racine, 'package.json'), 'utf8'));

const nom = manifeste.name;
const version = manifeste.version;
const buildNumber = manifeste.buildNumber ?? '';

// Le buildNumber vaut « version.compteur » : il sert tel quel de suffixe au nom du paquet.
if (!String(buildNumber).startsWith(`${version}.`)) {
	console.error(`Erreur : « buildNumber » (${buildNumber}) ne découle pas de « version » (${version}) dans package.json.`);
	process.exit(1);
}

// Sortie à la racine du projet (« *.vsix » est déjà exclu du paquet par .vscodeignore).
const fichier = path.join(racine, `${nom}-${buildNumber}.vsix`);

console.log(`Construction du paquet : ${path.relative(racine, fichier)}`);

// vsce n'est pas une dépendance locale : on passe par npx, qui prend l'installation globale si elle existe.
// Sous Windows, npx est un .cmd : Node refuse de le lancer sans « shell: true » (EINVAL).
const resultat = spawnSync(
	'npx',
	['vsce', 'package', '--out', `"${fichier}"`, ...process.argv.slice(2)],
	{ cwd: racine, stdio: 'inherit', shell: true },
);

if (resultat.error) {
	console.error('Échec du lancement de vsce :', resultat.error.message);
	process.exit(1);
}

process.exit(resultat.status ?? 1);
