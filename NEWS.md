# News — Arduino VsCode IDE

Ce document recense toutes les modifications apportées par rapport à l'extension originale Microsoft vscode-arduino (v0.4.12, archivée en 2023).

Chaque modification est marquée selon son origine :
- **[Fork community]** — repris du [vscode-arduino community fork](https://github.com/vscode-arduino/vscode-arduino), avec référence à l'issue/PR correspondante
- **[Nouveau]** — introduit dans ce fork (electropol-fr / FrankSAURET)

---

## Sécurité

| Modification | Détails | Origine |
|---|---|---|
| Correction CVE-2024-43488 | Le serveur web local (Board Manager, Library Manager) est désormais protégé par un token cryptographique aléatoire (32 octets). Toutes les requêtes `/api/` doivent présenter ce token via le header `x-auth-token` ou le paramètre `token`. | **[Nouveau]** v0.5.0 |
| Suppression complète de la télémétrie | Application Insights, NSAT survey et UUID tracking entièrement supprimés. Aucune donnée utilisateur n'est envoyée. | **[Nouveau]** v0.5.0 |

---

## Backend & Arduino CLI

| Modification | Détails | Origine |
|---|---|---|
| Arduino CLI uniquement | Suppression du support de l'Arduino IDE legacy. Le flag `arduino.useArduinoCli` et tous les chemins d'exécution Arduino IDE ont été retirés. L'extension cible exclusivement `arduino-cli`. | **[Nouveau]** v0.5.0 |
| Téléchargement automatique du CLI | Si Arduino CLI est absent du système, l'extension propose de le télécharger depuis les GitHub Releases officielles, avec barre de progression et vérification des mises à jour. Stocké dans `[extensionPath]/arduino-cli/`. | **[Nouveau]** v0.5.0 |
| Ordre de résolution du CLI | Le CLI est recherché dans cet ordre : paramètre `arduino.path` → CLI téléchargé par l'extension → PATH système. | **[Nouveau]** v0.5.0 |

---

## Interface utilisateur

| Modification | Détails | Origine |
|---|---|---|
| Rebranding complet | Extension renommée `arduino-vscode-ide` / "Arduino VsCode IDE" (éditeur : `electropol-fr`). Nouvelle icône. Schéma de version CalVer (YYYY.MM.patch). | **[Nouveau]** v2026.4.1 |
| Home Panel avec rail de navigation | Nouveau webview central avec rail d'icônes vertical (navigation rail) et iframe chargeant les vues existantes (Board Manager, Library Manager, Examples, Board Config, Settings). Inclut un écran d'accueil avec boutons Quick Access. | **[Nouveau]** v2026.4.1 |
| Disposition 3 colonnes au démarrage | Mise en page par défaut au lancement : Explorer à gauche, Home Panel au centre, Code Editor à droite. | **[Nouveau]** v2026.4.1 |
| Quick Access TreeView | Vue latérale dans l'Activity Bar avec accès rapide aux commandes : New Project, Open Project, Verify, Upload, Select Board, Serial Monitor, Serial Tracer, Board Manager, Library Manager, Examples. | **[Nouveau]** v2026.4.1 |
| Icônes dans la barre titre de l'éditeur | Boutons Verify, Upload, Serial Monitor et Serial Tracer affichés dans la barre titre des fichiers `.ino` (groupe `navigation`). | **[Nouveau]** v2026.4.1 |
| Intégration Teleplot | Lancement de Teleplot depuis le bouton "Serial Tracer". Le paramètre `arduino.teleplotOpenMode` contrôle le placement : `newTab` (défaut), `newPanel`, `splitRight`. Installation automatique de Teleplot proposée si absent. | **[Nouveau]** v2026.4.1 |
| Theme Manager | Sélection de thème Arduino (Arduino, Arduino Light, Arduino Dark) avec proposition d'installation de l'extension `oscarewenstudent.arduino-themes-vsc`. La préférence est enregistrée au niveau workspace pour éviter les conflits multi-workspace. | **[Nouveau]** v2026.4.1 |
| Commandes Create/Open sans CLI pré-configuré | `Arduino: Initialize` et `Arduino: Open Project Folder` fonctionnent sans CLI installé au préalable — le téléchargement automatique est proposé si nécessaire. | **[Nouveau]** v0.5.0 |

---

## IntelliSense

| Modification | Détails | Origine |
|---|---|---|
| Normalisation `--param` | Les arguments `--param name value` sont convertis en `--param=name=value` pour compatibilité clang/IntelliSense (GCC accepte les deux formes, clang non). | **[Fork community]** [PR #84](https://github.com/vscode-arduino/vscode-arduino/pull/84) |
| Macro `ARDUINO` auto-ajoutée | La macro `ARDUINO=10813` est automatiquement injectée dans les defines IntelliSense (valeur 10800+ = équivalent Arduino IDE 1.8+). Corrige les bibliothèques qui vérifient cette macro. | **[Fork community]** [#70](https://github.com/vscode-arduino/vscode-arduino/issues/70) |
| Rate-limiting de l'analyse | Délai d'analyse porté à 5 secondes pour éviter les pics CPU lors de changements board/config/sketch répétés. | **[Fork community]** [#76](https://github.com/vscode-arduino/vscode-arduino/issues/76) |
| Support `boards.local.txt` | Prise en charge des fichiers de surcharge `boards.local.txt` pour les configurations de cartes personnalisées. | **[Fork community]** [#77](https://github.com/vscode-arduino/vscode-arduino/issues/77) |

---

## Moniteur série

| Modification | Détails | Origine |
|---|---|---|
| Vidage du champ de saisie après envoi | Le champ de texte se vide automatiquement après transmission d'un message. | **[Fork community]** [#81](https://github.com/vscode-arduino/vscode-arduino/issues/81) |
| Timeout de fermeture du port (5 s) | Ajout d'un timeout de 5 secondes à la fermeture du port série, avec fermeture forcée en fallback. Évite le blocage lors des uploads. | **[Fork community]** [#74](https://github.com/vscode-arduino/vscode-arduino/issues/74), [#75](https://github.com/vscode-arduino/vscode-arduino/issues/75) |
| Correction séquence DTR/RTS ESP32 | La séquence DTR/RTS pour ESP32 est corrigée afin d'éviter les boucles de boot involontaires lors du téléversement. | **[Fork community]** [#86](https://github.com/vscode-arduino/vscode-arduino/issues/86) |
| Wait-for-port USB CDC | Après upload sur les cartes CDC natives (Leonardo, Micro, Arduino Uno R4 WiFi...), l'extension attend la réapparition du port série avant de continuer (timeout 5 s). | **[Fork community]** [#85](https://github.com/vscode-arduino/vscode-arduino/issues/85) |

---

## Support multi-root workspace

| Modification | Détails | Origine |
|---|---|---|
| Résolution contextuelle du workspace root | `ArduinoWorkspace.rootPath` se base sur le fichier actif dans l'éditeur pour déterminer le dossier de travail. Chaque sous-dossier peut avoir son propre `arduino.json`. | **[Fork community]** [#71](https://github.com/vscode-arduino/vscode-arduino/issues/71) |
| Commandes workspace-aware | Verify, Upload, Rebuild IntelliSense Configuration opèrent dans le contexte du workspace folder du fichier actif. | **[Fork community]** [#71](https://github.com/vscode-arduino/vscode-arduino/issues/71) |

---

## Nouveaux paramètres de configuration

| Paramètre | Défaut | Description | Origine |
|---|---|---|---|
| `arduino.customLibraryPath` | `""` | Répertoire supplémentaire de bibliothèques passé au CLI (`--library`). | **[Fork community]** [#50](https://github.com/vscode-arduino/vscode-arduino/issues/50) |
| `arduino.arduinoCliConfigFile` | `""` | Chemin vers un fichier `arduino-cli.yaml` local, utilisé à la place de la configuration globale. | **[Nouveau]** v0.5.0 |
| `arduino.theme` | `"Arduino Light"` | Thème Arduino à appliquer (Arduino, Arduino Light, Arduino Dark). | **[Nouveau]** v2026.4.1 |
| `arduino.teleplotOpenMode` | `"newTab"` | Mode d'ouverture de Teleplot : `newTab`, `newPanel`, `splitRight`. | **[Nouveau]** v2026.4.1 |
| `arduino.outputVerbosity` | `"normal"` | Verbosité du panneau de sortie : `compact`, `normal`, `verbose`. | **[Nouveau]** v2026.4.1 |

---

## Corrections de bugs & normalisation

| Modification | Détails | Origine |
|---|---|---|
| Normalisation du chemin de build | Le chemin `output` de `arduino.json` est normalisé avec `path.normalize()` et la structure de dossiers est créée automatiquement. | **[Fork community]** [#72](https://github.com/vscode-arduino/vscode-arduino/issues/72) |

---

## Résumé : ce qui vient du fork community

Les points suivants ne sont pas dans l'extension Microsoft originale mais étaient déjà dans le [fork community vscode-arduino](https://github.com/vscode-arduino/vscode-arduino) avant d'être intégrés ici :

- Multi-root workspace support [#71]
- Custom library path (`arduino.customLibraryPath`) [#50]
- Wait-for-port USB CDC [#85]
- Macro `ARDUINO` IntelliSense [#70]
- Support `boards.local.txt` [#77]
- Normalisation du chemin de build [#72]
- Normalisation `--param` IntelliSense [PR #84]
- Rate-limiting IntelliSense [#76]
- Vidage champ moniteur série après envoi [#81]
- Timeout fermeture port série [#74, #75]
- Correction DTR/RTS ESP32 [#86]
- Support fichier `arduino-cli.yaml` local

---

## Ce qui est exclusif à ce fork

- Correction sécurité CVE-2024-43488
- Suppression de toute télémétrie
- Home Panel avec rail de navigation et écran d'accueil
- Quick Access TreeView dans l'Activity Bar
- Intégration Teleplot (installation, lancement, positionnement)
- Theme Manager (Arduino Light / Dark / Arduino)
- Icônes dans la barre titre de l'éditeur (Verify, Upload, Serial Monitor, Serial Tracer)
- Téléchargement automatique d'Arduino CLI avec vérification des mises à jour
- Rebranding complet (nom, éditeur, icône, CalVer)
- Paramètre `arduino.outputVerbosity` (compact / normal / verbose)
