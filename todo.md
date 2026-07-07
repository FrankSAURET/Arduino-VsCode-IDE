# À faire

1. ⬜ Tester sur machine réelle : installation d'une bibliothèque depuis le Library Manager (doit apparaître « installée » — correctif v2026.7.0)
2. ⬜ Tester l'installation d'une plateforme tierce (ESP32) via URL additionnelle (correctif v2026.7.0)
3. ⏳ Ajouter `package.nls.fr.json` (traduction française des titres de commandes/réglages du Marketplace)
4. ⏳ Disposer proprement `_sketchStatusBar` (deviceContext.ts) et le watcher du CompletionProvider à la désactivation (impact faible)
5. ⏳ Fichiers supprimables du repo (aucun supprimé, cf. liste v2026.7.0 ci-dessous)

# v2026.7.0 — Audit complet : 25 bugs corrigés + réduction du VSIX

## Bugs critiques
1. ✅ `libraryManager`/`arduinoSettings` : les bibliothèques installées n'étaient pas détectées — l'extension lisait le sketchbook depuis le registre Windows (`H:\OneDrive\Documents\Arduino`) au lieu de la config réelle du CLI (`arduino-cli config dump` → `directories.user` = `h:\Nuage\Documents\Arduino`). Idem pour `directories.data` (packages). **Bug n°1 du todo résolu.**
2. ✅ `util.ts cp()` : condition inversée — la copie de fichier ne copiait jamais (et pouvait tronquer un fichier copié sur lui-même). « Ouvrir un exemple » mono-fichier créait un dossier vide.
3. ✅ `arduino.ts setPref()` : commande CLI invalide (`--build-property` en flag racine) — les URLs additionnelles (ESP32, STM32…) n'étaient jamais transmises au CLI → plateformes tierces invisibles. Remplacé par `--additional-urls` passé à `core install` / `update-index`.
4. ✅ `arduinoActivator` : une activation échouée (réseau coupé…) restait en cache pour toute la session — toutes les commandes mortes jusqu'au reload. Le cache est maintenant purgé pour permettre un nouvel essai.

## Bugs majeurs
5. ✅ « Refresh index » n'exécutait rien (`core/lib install dummy` au lieu de `update-index`) — nouvelles libs/versions invisibles à jamais.
6. ✅ Exit code 1 du CLI traité comme succès : tout échec d'installation (réseau, nom introuvable) affichait « Installed » — l'erreur remonte maintenant au webview (HTTP 500).
7. ✅ `configurationProvider` : `output: "."` dans arduino.yaml + F5 supprimait récursivement **tout le workspace** — garde-fou ajouté (le dossier de sortie doit être un sous-dossier strict).
8. ✅ `debuggerManager` : chemin OpenOCD non quoté — debug impossible si nom d'utilisateur Windows avec espace.
9. ✅ `boardManager` : fuite de listeners à chaque ouverture du Board Manager (analyses IntelliSense et rechargements en cascade).
10. ✅ `arduino.ts includeLibrary()` : glob avec backslashes Windows — « Include Library » n'insérait aucun `#include`.
11. ✅ Flags de compilation (`--library`, `--build-property`) passés à `arduino-cli upload` → « Upload using CLI » échouait si customLibraryPath défini.
12. ✅ `libraryManager` : index JSON corrompu ou `library.properties` sans `name` → vue bloquée sur « Loading... » pour toujours (+ réponse HTTP 500 systématique dans `arduinoContentProvider`).
13. ✅ `extension.ts` : activation au démarrage sans `.catch` → échec silencieux, extension morte sans message.
14. ✅ `extension.ts selectSketch` : `replace("\\", "/")` ne convertissait que le premier backslash → exclusions de recherche inopérantes.
15. ✅ Ouverture d'un `.pde` : double renommage (2 listeners) → exception ENOENT + fermeture d'éditeur intempestive.

## Bugs mineurs
16. ✅ `win32.ts` : `where arduino-cli` multi-résultats (choco + winget) → chemin poubelle multi-lignes.
17. ✅ `configurationProvider` : `indexOf > 0` ratait `${file}` en début de commande gdb + replace non global.
18. ✅ `usbDetector` : promesses flottantes sans `.catch` (update index, install board) → unhandled rejections.
19. ✅ `extension.ts commandExecution` : erreurs avalées sans notification — l'utilisateur voyait des commandes « qui ne font rien ».
20. ✅ `cliDownloader` : coupure réseau pendant le téléchargement du CLI → notification de progression bloquée à l'infini.
21. ✅ `boardManager updatePackageIndex` : écriture de config non attendue (race avec relecture immédiate).
22. ✅ `programmer.ts` : regex de split `[\r|\r\n|\n]` splittait aussi sur `|`.
23. ✅ `arduino.ts installBoard` : nettoyage pré-install sur un chemin qui n'existe jamais — supprimé (le CLI gère le remplacement).
24. ✅ `arduinoHomePanel` : traductions injectées dans du JS entre quotes simples (cassait si apostrophe) + variables inutilisées nettoyées.
25. ✅ README : lien image `<images/Doc-Page 1.png>` mal réécrit par vsce → **image cassée sur le Marketplace** ; remplacé par `%20`.

## Réduction du VSIX (.vscodeignore)
1. ✅ Bug corrigé : `images/examples/**` était exclu alors que l'arbre d'exemples l'utilise à l'exécution (icônes manquantes en prod)
2. ✅ Exclus en plus : `todo.md` (était publié !), `images/Doc-Page 1.png` (243 Ko, servie par GitHub via le README réécrit), prebuilds serialport Android (228 Ko), sources C++ de serialport/usb-detection (~110 Ko), polices .eot/.ttf des webviews (64 Ko), libs uuid navigateur
3. ✅ ~650 Ko de moins dans le VSIX décompressé (~10 %)

## Fichiers supprimables du repo (RIEN n'a été supprimé)
- `images/serialMonitor - Copie.svg`, `images/serialTracer-V1.svg`, `images/upload-v1.svg`, `images/verify-V1.svg` (anciennes versions d'icônes, non référencées)
- `images/ArduinoCommunityLogo_Complet.svg`, `images/ArduinoCommunityLogo_Couleur.svg` (non référencées ; seule `_Gris.svg` est utilisée)
- `arduino.log`, `debug.log` (journaux d'exécution)
- `arduino-vscode-ide-2026.06.1.vsix` (artefact régénérable)
- `azure-pipelines.yml`, `build/` (pipeline Azure DevOps de Microsoft ; la CI est sur GitHub Actions et ne les référence pas)
- `.ackrc` (config de l'outil `ack`, obsolète)
- `NEWS.md` (annonces historiques Microsoft)
- `.vscode-test/` (cache de tests, retéléchargé automatiquement)
- ⚠️ NON supprimables : `typings/` (déclare `vscode.l10n` pour la compilation), `tslint.json` (utilisé par `npm run lint`), `misc/` (mappings usb/débogueur utilisés à l'exécution), `snippets/sample.ino` (utilisé par « nouveau projet »)

# v2026.06.1
1. ✅ les mots de code tels que HIGH, pinMode ou encore millis sont soulignés en rouge
2. ✅ Réouverture de l'onglet VsCode Arduino : suivait le mauvais groupe d'éditeurs / largeur minimale
