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

// Le buildNumber vaut « ANNÉE.MOIS.incrément.compteur » et sert tel quel de suffixe
// au nom du paquet.
//
// Son préfixe est le numéro de la PROCHAINE publication (celui ouvert dans le
// CHANGELOG), pas le champ « version », qui reste sur la dernière version publiée
// jusqu'au jour de la publication. Un écart entre les deux est donc l'état normal
// pendant tout le développement, et non une erreur.
if (!/^\d+\.\d+\.\d+\.\d+$/.test(String(buildNumber))) {
	console.error(`Erreur : « buildNumber » (${buildNumber}) doit valoir ANNÉE.MOIS.incrément.compteur dans package.json.`);
	process.exit(1);
}

// Seul cas vraiment fautif : un buildNumber en retard sur la version publiée.
// Comparaison segment par segment, au premier qui diffère — sinon un passage de mois
// (2026.10.1 face à 2026.9.5) serait pris pour un retour en arrière.
const enNombres = (v) => String(v).split('.').slice(0, 3).map(Number);
const prefixeBuild = enNombres(buildNumber);
const versionPubliee = enNombres(version);
const rang = prefixeBuild.findIndex((n, i) => n !== versionPubliee[i]);
if (rang !== -1 && prefixeBuild[rang] < versionPubliee[rang]) {
	console.error(`Erreur : « buildNumber » (${buildNumber}) est antérieur à « version » (${version}) dans package.json.`);
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
