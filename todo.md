# À faire

1. ⬜ Tester sur machine réelle : installation d'une bibliothèque depuis le Library Manager (doit apparaître « installée » — correctif v2026.7.0)
2. ⬜ Tester l'installation d'une plateforme tierce (ESP32) via URL additionnelle (correctif v2026.7.0)
3. ✅ Ajouter `package.nls.fr.json` (traduction française des titres de commandes/réglages du Marketplace) — v2026.7.4
4. ✅ Disposer proprement `_sketchStatusBar` (deviceContext.ts) et le watcher du CompletionProvider à la désactivation — v2026.7.4
5. ✅ Fichiers supprimables du repo (aucun supprimé, cf. liste v2026.7.0 ci-dessous)
6. ⬜ Vérifier l'affichage français des commandes/réglages (palette + UI des réglages) sur une instance VS Code en français
7. ⏳ macOS / Linux : valider la détection du CLI embarqué d'Arduino IDE 2 sur machine réelle (v2026.7.3)
8. ⬜ Vérifier l'affichage réel de la notification Kablix (premier lancement + après mise à jour) sur une instance VS Code
9. ⬜ Valider l'installation sur VSCodium / Open VSX maintenant que `ms-vscode.cpptools` n'est plus une dépendance dure (v2026.8.0)
10. ⬜ Vérifier l'affichage réel de la notification C/C++ (VS Code sans cpptools installé, IntelliSense activé)

# v2026.8.0 — `ms-vscode.cpptools` : dépendance dure → recommandation

1. ✅ Cause : `extensionDependencies: ["ms-vscode.cpptools"]` forçait l'installation de C/C++ alors que l'extension n'appelle **aucune** de ses API — le seul lien est le fichier `.vscode/c_cpp_properties.json` généré par `src/arduino/intellisense.ts`, que cpptools lit pour l'IntelliSense.
2. ✅ Blocage Open VSX : `ms-vscode.cpptools` n'y est pas publié (licence Microsoft, non redistribuable) → sur VSCodium/Gitpod l'installation échouait avec « dépendance introuvable », rendant la publication Open VSX inutilisable.
3. ✅ `package.json` : bloc `extensionDependencies` supprimé. Compilation, téléversement, moniteur série, gestionnaires de cartes/bibliothèques : aucun impact (aucun appel à cpptools dans `src/`).
4. ✅ Coloration syntaxique préservée : elle vient de `syntaxes/arduino.tmLanguage` + la grammaire `cpp` native de VS Code, pas de cpptools.
5. ✅ `src/arduino/extensionRecommendation.ts` : logique factorisée (`shouldRecommend` + `promptRecommendation`) et nouvelle `recommendCppTools()` — notification douce proposant d'installer C/C++, affichée **uniquement** si cpptools est absent **et** que la génération IntelliSense est active (`isCompilerParserEnabled()`).
6. ✅ Même cadence que Kablix : premier lancement + après chaque mise à jour, état dans `globalState` (`arduino.cppToolsRecommendation`), boutons « Installer C/C++ » / « Plus tard » / « Ne plus proposer ». Repli sur la recherche du Marketplace si l'installation automatique échoue (cas Open VSX).
7. ✅ Appel non bloquant dans `extension.ts` à 20 s (après Kablix à 8 s) pour ne jamais empiler deux notifications.
8. ✅ `gulpfile.js` : suppression du hack qui vidait puis restaurait `extensionDependencies` autour de `npm test` (et de l'import `fs` devenu inutile) — devenu sans objet.
9. ✅ Traductions FR ajoutées à `l10n/bundle.l10n.fr.json` (3 chaînes).
10. ✅ README : nouvelle section « C/C++ extension (optional) » sous *Prerequisites*, mentionnant clangd comme solution de repli sur les éditeurs sans Marketplace Microsoft.
11. ✅ Build + lint OK, suite de tests **47 passing** — dont la suite exécutée pour la première fois sans le contournement du gulpfile.
12. ℹ️ `shouldRecommendKablix` conservé comme alias de `shouldRecommend` (compatibilité des tests existants).

# v2026.7.5 — Recommandation de l'extension Kablix

1. ✅ `src/arduino/extensionRecommendation.ts` : notification recommandant `electropol-fr.kablix` (simulateur Arduino et Pico pi, C/C++ et MicroPython).
2. ✅ Déclenchement au **premier lancement** et **après chaque mise à jour** : la version de l'extension du dernier affichage est mémorisée dans `globalState` (`arduino.kablixRecommendation`) ; un numéro de version différent rejoue la proposition.
3. ✅ Pas de notification si Kablix est déjà installée. Boutons : « Installer Kablix » (installe via `workbench.extensions.installExtension`), « Plus tard », « Ne plus proposer » (silence définitif).
4. ✅ Marquage « affiché » **avant** l'attente de la réponse : fermer la notification sans répondre ne la fait pas revenir à l'activation suivante.
5. ✅ Appel non bloquant dans `extension.ts` (`setTimeout` 8 s, après le contrôle de mise à jour du CLI) — aucun impact sur le chemin critique d'activation.
6. ✅ Repli si l'installation automatique échoue : avertissement + ouverture du Marketplace filtré sur `@id:electropol-fr.kablix`.
7. ✅ Traductions FR ajoutées à `l10n/bundle.l10n.fr.json` (texte exact demandé, avec guillemets français).
8. ✅ 8 assertions vérifiées sur `shouldRecommendKablix` (premier lancement, mise à jour, même version, déjà installée, refus définitif, version inconnue) + `test/extensionRecommendation.test.ts` ajouté à la suite.

# v2026.7.4 — Traduction française du Marketplace + fuites de ressources

1. ✅ `package.nls.fr.json` créé : 48 clés traduites (titres de commandes, noms de vues, descriptions des réglages). Parité vérifiée par script — aucune clé manquante ni en trop, toutes les clés `%…%` de `package.json` résolues.
2. ✅ Terminologie alignée sur Arduino IDE 2 en français : « Vérifier », « Téléverser », « Croquis », « Gestionnaire de bibliothèques », « programmateur ».
3. ✅ `deviceContext.dispose()` : `_sketchStatusBar` désormais libéré (l'instance est déjà dans `context.subscriptions`, donc réellement appelé).
4. ✅ `completionProvider` : ajout d'un `dispose()` libérant son `FileSystemWatcher`, **et** enregistrement de l'instance dans `context.subscriptions` — le disposable de `registerCompletionItemProvider` ne libère que l'enregistrement, pas l'instance, donc le watcher fuyait à chaque désactivation.
5. ℹ️ `arduino.view.container.title` reste « Arduino » en français (nom propre) ; 4 clés définies mais non référencées dans `package.json` (`view.launcher`, `view.boardManager`, `view.libraryManager`, `view.examples`) — préexistant, hors périmètre.
6. ⬜ Non vérifié : rendu réel des chaînes traduites dans une instance VS Code configurée en français.

# v2026.7.3 — Détection de l'arduino-cli embarqué dans Arduino IDE 2

1. ✅ Cause : Arduino IDE 2 embarque son propre `arduino-cli` dans ses ressources internes (`resources/app/lib/backend/resources`) **sans l'exposer au PATH**. Les 3 étapes de résolution échouaient toutes (réglage `arduino.path` non défini, `where arduino-cli` négatif, dossier `arduino-cli/` exclu du VSIX) → prompt de téléchargement affiché alors qu'un CLI valide était installé.
2. ✅ `win32.ts` : repli sur `%ProgramFiles%`, `%ProgramFiles(x86)%` et `%LOCALAPPDATA%\Programs` + `Arduino IDE\resources\app\lib\backend\resources`.
3. ✅ `darwin.ts` : repli sur `/Applications` et `~/Applications` + `Arduino IDE.app/Contents/Resources/app/lib/backend/resources`.
4. ✅ `linux.ts` : repli sur `/opt`, `/usr/local/share`, `/usr/share`, `~/.local/share`, `~` (dossiers `arduino-ide` / `Arduino IDE`).
5. ✅ Le repli ne s'active que si le PATH n'a rien donné : aucun changement de comportement pour un CLI déjà dans le PATH.
6. ✅ Effet de bord bénéfique : `applyCliConfigDirectories()` interroge ce CLI et récupère les dossiers réels de l'IDE 2 (`arduino-cli.yaml`) → cartes et sketchbook partagés avec l'IDE, sans duplication.
7. ✅ Vérifié à l'exécution sous Windows (vrai code compilé) : `resolveArduinoPath()` → `C:\Program Files\Arduino IDE\resources\app\lib\backend\resources`, `usableCli` = true.
8. ⏳ macOS et Linux non testés sur machine réelle (chemins déduits du packaging Electron).
9. ⏳ AppImage Linux non couvert : ressources montées dans un dossier temporaire imprévisible → `arduino.path` reste nécessaire pour ce format.

# v2026.7.1 — Régression 2026.7.0 : plus aucune carte ni bibliothèque

1. ✅ Cause : sans `arduino-cli` présent, le prompt de téléchargement était `await` dans le chemin critique d'activation → VS Code annulait l'activation (« Canceled ») → `boardManager` jamais créé → tous les handlers du webview en échec (cartes, bibliothèques, exemples, config vides).
2. ✅ `arduinoActivator` : le prompt de téléchargement du CLI passe **hors du chemin critique** (non bloquant). Les cartes/bibliothèques déjà installées se chargent depuis les fichiers d'index sans CLI. Après téléchargement, réinit des réglages + rechargement cartes/bibliothèques.
3. ✅ `arduinoSettings.usableCli` : détection d'un `arduino-cli` réellement invocable (le binaire existe), au lieu de se fier à `arduinoPath` (qui peut désigner un IDE Arduino 1.x sans CLI).
4. ✅ `tryResolveArduinoPath` : un `arduino-cli` téléchargé par l'extension prime sur un chemin Arduino résolu qui ne fournit pas de CLI.

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
