/**
 * Publie la version courante en une commande : Marketplace Visual Studio Code PUIS registre Open VSX.
 * Usage : npm run publier            (publication réelle)
 *         npm run publier -- --dry-run   (construit le .vsix, ne publie rien)
 *         npm run publier -- --pre-release
 *         npm run publier -- --force     (passe outre le garde-fou du CHANGELOG)
 *
 * Pourquoi « publier » et non « publish » : npm déclenche tout script nommé « publish » sur un
 * « npm publish », même avec --dry-run (constaté : un essai a publié pour de bon). Et « npm publish »
 * vise le registre npm, pas les places de marché. Le manifeste est en outre marqué « private » : un
 * « npm publish » réel est refusé et n'envoie jamais le paquet à npm.
 *
 * Un seul .vsix, construit une fois (version publique, sans le buildNumber), envoyé aux deux registres :
 * ce qui est en ligne est strictement identique des deux côtés.
 *
 * Identifiants, jamais passés en argument (ils resteraient dans l'historique du terminal) :
 * - OVSX_PAT : variable d'environnement, lue par ovsx. Exigée AVANT toute publication, pour ne pas
 *   publier d'un côté seulement.
 * - VSCE_PAT : variable d'environnement, ou connexion mémorisée par « vsce login electropol-fr ».
 *
 * Script identique dans les quatre extensions de Frank : seule la constante OPTIONS_PAQUET change.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Options propres au projet pour « vsce package » (ex. ['--no-dependencies'], ['--yarn']).
const OPTIONS_PAQUET = [];

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifeste = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const essai = args.has('--dry-run');
const preRelease = args.has('--pre-release');
const forcer = args.has('--force');

const echec = (message) => {
	console.error(`\nErreur : ${message}`);
	process.exit(1);
};

// Nom relatif : le chemin du projet contient des espaces, que le shell Windows découperait.
const fichier = `${manifeste.name}-${manifeste.version}.vsix`;

// Garde-fou : une section « prochaine publication » en tête du CHANGELOG signifie que le lot n'est pas
// prêt (« on prépare la publication » n'a pas eu lieu).
const chemin = join(racine, 'CHANGELOG.md');
if (existsSync(chemin)) {
	const titre = readFileSync(chemin, 'utf8').split(/\r?\n/).find((ligne) => ligne.startsWith('## ')) ?? '';
	if (/prochaine publication/i.test(titre) && !forcer) {
		echec(`la section de tête du CHANGELOG est « ${titre} ». Préparer la publication d'abord, ou ajouter --force.`);
	}
	if (!titre.includes(manifeste.version)) {
		console.warn(`Attention : la section de tête du CHANGELOG (« ${titre} ») ne contient pas la version ${manifeste.version}.`);
	}
}

if (!essai && !process.env.OVSX_PAT) {
	echec("variable d'environnement OVSX_PAT absente : rien n'a été publié.");
}

// npx est un .cmd sous Windows : Node refuse de le lancer sans « shell: true ».
const lancer = (etape, commande) => {
	console.log(`\n=== ${etape}\n> ${commande.join(' ')}`);
	const r = spawnSync(commande[0], commande.slice(1), { cwd: racine, stdio: 'inherit', shell: true });
	if (r.status !== 0) {
		echec(`« ${etape} » a échoué (code ${r.status ?? 'inconnu'}).`);
	}
};

console.log(`Publication de ${manifeste.name} ${manifeste.version}${preRelease ? ' (pré-version)' : ''}${essai ? ' — ESSAI, rien ne sera envoyé' : ''}`);

lancer('Construction du paquet', ['npx', 'vsce', 'package', ...OPTIONS_PAQUET, ...(preRelease ? ['--pre-release'] : []), '--out', fichier]);

if (essai) {
	console.log(`\nEssai terminé : ${fichier} construit, rien publié.`);
	process.exit(0);
}

lancer('Visual Studio Marketplace', ['npx', 'vsce', 'publish', '--packagePath', fichier, ...(preRelease ? ['--pre-release'] : [])]);

// Si cette étape échoue, la version est déjà en ligne sur le Marketplace : le message le rappelle.
console.log('\n=== Open VSX');
const r = spawnSync('npx', ['ovsx', 'publish', fichier, ...(preRelease ? ['--pre-release'] : [])],
	{ cwd: racine, stdio: 'inherit', shell: true });
if (r.status !== 0) {
	echec(`Open VSX a échoué (code ${r.status ?? 'inconnu'}) ALORS QUE le Marketplace a déjà publié ${manifeste.version}. Relancer seulement : npx ovsx publish ${fichier}`);
}

console.log(`\nPublié : ${manifeste.name} ${manifeste.version} sur le Marketplace et sur Open VSX.`);
