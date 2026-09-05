# Plantage de l'hôte d'extensions — code 134

État au 5 septembre 2026. **Cause identifiée, correction appliquée — à valider par F5 répétés.**

## Le défaut

À chaque F5 (`Launch Extension`), la fenêtre de développement démarre puis son hôte
d'extensions meurt. Aléatoire : parfois le 1er lancement, parfois le 10e.

### Signature, toujours identique

```
main.log   Extension host with pid <N> exited with code: 134, signal: unknown.
main.log   [UtilityProcess id: <N>, type: extensionHost, pid: <N>]: crashed with code 134 and reason 'crashed'
```

- **Délai** : ~1,2 s après `Chargement de l'extension de développement sur c:\...`
- **Aucun vidage mémoire** produit, alors que Crashpad et la capture Windows étaient armés
  → le processus ne plante pas, il est **arrêté volontairement**
- `code 134` = `SIGABRT` = `abort()`

### Repère fiable pour trier les fenêtres

| | `renderer.log` | dossier `exthost/` |
|---|---|---|
| fenêtre saine | **91-92 lignes** | présent |
| fenêtre plantée | **59-60 lignes** | absent |

La coupure tombe **toujours au même endroit**. Dernière ligne commune aux deux :

```
[warning] [idleberg.nsis]: Un ou plusieurs extraits de l'extension 'nsis'...
```

La fenêtre saine poursuit avec, dans l'ordre :

```
[info]  [AccountPolicyGate] apply: state=inactive...
[error] [Extension Host] (node:XXXX) [DEP0040] DeprecationWarning: punycode
[error] [Extension Host] (node:XXXX) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true
[info]  Settings Sync: Account status changed from uninitialized to available
```

**La fenêtre plantée n'écrit jamais la ligne `punycode`.** L'hôte meurt avant sa
première ligne à lui.

### Symptômes visibles

- Vérifier / téléverser sans effet
- Thème sombre au lieu d'« Arduino light » (activation jamais terminée)
- Une relance complète de VS Code améliore temporairement

### Journaux

```
%APPDATA%\Code\logs\<session>\main.log
%APPDATA%\Code\logs\<session>\window<N>\renderer.log
```

## Pistes écartées — ne pas refaire

| Piste | Résultat |
|---|---|
| Profil isolé `--user-data-dir` (args puis runtimeArgs) | argument ignoré par VS Code |
| Désinstaller l'extension installée en doublon | plante installée ET désinstallée |
| `--disable-extensions` | plante quand même |
| Mémoire | 4,8 Go libres, validation 45 % — aucune tension |
| Ports / processus résiduels entre deux F5 | rien ne traîne |
| Rang du lancement | aléatoire : 1er, 2e, 3e, 6e, 10e selon les séries |
| `--verbose`, `--log=trace`, `NODE_OPTIONS` | ignorés |
| Synchronisation Microsoft coupée | plante quand même |
| Vidage Crashpad + Windows | aucun vidage produit |
| Écart de temps entre deux F5 | **corrélation nulle** : 42 s survit ET plante |
| Nombre de fenêtres ouvertes | pas de rang fixe, hypothèse abandonnée |

### Seul gain réel obtenu

`runtimeExecutable: "${execPath}"` **retiré** de `.vscode/launch.json`. Il faisait
démarrer l'hôte en pause (`STOPPED on first line for debugging`). Plantages passés
de systématiques à intermittents. À conserver.


## Cause trouvée — ressources non libérées à l'arrêt

L'analyse des journaux `main.log` de cinq sessions donne un motif constant :
le **134 tombe à la fermeture d'un hôte**, jamais pendant son fonctionnement.
Les arrêts propres sortent en `code: 0`, les autres en `134`.

Exemple (session `20260905T155052`) :

```
15:52:08.478  window2  Started local extension host with pid 24072
15:52:48.145  window3  Started local extension host with pid 30524
15:52:49.360  24072 exited with code: 0      <- fermeture propre
15:52:49.360  30524 exited with code: 134    <- abattu
```

`abort()` sans vidage mémoire = arrêt volontaire : VS Code demande à l'hôte de
se terminer, celui-ci ne rend jamais la main, le délai d'arrêt expire, VS Code
l'abat. Les ~1,2 s observées sont ce délai.

Trois ressources empêchaient la boucle d'événements de se vider :

| Ressource | Où | Problème |
|---|---|---|
| Serveur HTTP local | `localWebServer.ts` | `http.createServer(...).listen()` — **jamais fermé** |
| Minuteur du panneau d'accueil | `arduinoHomePanel.ts` | `setInterval` 5 s, éliminé seulement si le panneau l'est |
| Minuteurs de démarrage différé | `extension.ts` | `setTimeout` 200 ms / 5 s / 8 s / 20 s, non annulables |

`deactivate()` ne faisait qu'appeler `stopListening()`. Rien d'autre n'était libéré.

Cela explique l'apparente aléa : la fenêtre survit tant qu'aucun arrêt n'est
demandé, et meurt dès qu'un F5 en ferme une pendant qu'une autre démarre.

## Correction appliquée

| Fichier | Changement |
|---|---|
| `src/arduino/localWebServer.ts` | `stop()` ajouté : `closeAllConnections()` puis `close()` |
| `src/arduino/arduinoContentProvider.ts` | `dispose()` ajouté : ferme le serveur, élimine l'émetteur d'événements |
| `src/arduino/arduinoHomePanel.ts` | `disposeCurrent()` statique pour éliminer le panneau restant |
| `src/extension.ts` | fournisseur remonté au niveau module ; minuteurs différés enregistrés et annulables ; `deactivate()` libère tout, chaque étape isolée en `try/catch` |
| `src/common/usbDetectionLoader.ts` | **nouveau** — chargeur unique de `usb-detection` avec garde-fou ABI et cache |
| `src/debug/debuggerManager.ts` | passait par un `require("usb-detection")` **sans garde-fou ABI** — corrigé, il utilise le chargeur commun |
| `src/serialmonitor/usbDetector.ts` | garde-fou en double retiré, utilise le chargeur commun |

Le trou dans `debuggerManager.ts` était réel : `activationEvents` contient
`onDebug`, donc ce chemin se déclenche hors de tout garde-fou.

## Corrections tentées avant l'analyse — sans effet

Quatre modifications faites dans cette session. Après elles : **plantage dès le 2e F5**,
donc pas d'amélioration, possible aggravation. Sauvegardes des fichiers d'origine dans
le scratchpad de la session (`*.ts.bak`), sinon `git diff` / `git checkout`.

| Fichier | Changement | Verdict |
|---|---|---|
| `src/common/sys/win32.ts` | `execSync("where arduino-cli")` → `execFile` asynchrone | sans effet |
| `src/common/util.ts` | `chcp.com` appelé une seule fois, mis en cache | sans effet |
| `src/arduino/cliDownloader.ts` | `getSystemCliVersion` rendu asynchrone | sans effet |
| `src/serialmonitor/usbDetector.ts` | garde-fou ABI avant le `require` natif | sans effet |

Hypothèse derrière ces changements : un `execSync` figeait la boucle d'événements,
l'hôte cessait de répondre au signal de vie, VS Code le tuait. **Non confirmée** —
le plantage persiste sans aucun `execSync` sur le chemin d'activation Windows.

### Fait avéré et non exploité : `usb-detection` a une ABI périmée

```
node_modules/usb-detection/build/Release/detection.node   mars 2022
NODE_MODULE_VERSION 93   (l'hôte en exige ~137)
```

Chargement sous Node pur → exception propre :
`The module ... was compiled against a different Node.js version`.
`index.js` ligne 64 appelle `registerAdded` **au chargement du module** (fil natif).
`arduino.enableUSBDetection` vaut `true` dans les réglages utilisateur.

Mettre ce réglage à `false` **n'a pas empêché le plantage** → aggravant possible,
pas la cause. Le corriger reste souhaitable en soi (option A ci-dessous).

`serialport` v10 est en N-API (`node.napi.node`) → **hors de cause**.

## Pistes non explorées

1. **Attacher un débogueur natif** (WinDbg / `procdump -e -ma`) sur le processus
   hôte pour capturer le `abort()` — c'est le seul moyen de voir la pile réelle.
   Crashpad ne produit rien, donc viser le processus utilitaire directement.
2. **Bissection des extensions installées** : `--disable-extensions` a été essayé
   mais il ne désactive pas l'extension de développement elle-même. Désactiver
   une par une les extensions tierces (cortex-debug, pythonsnippets3, nsis,
   docs-markdown — toutes bruyantes dans le journal juste avant la coupure).
3. **Tester sur un dépôt vierge** : cloner l'extension ailleurs, `npm ci`, F5.
   Sépare « défaut du code » de « défaut de l'environnement ».
4. **Réduire `activate()`** : commenter tout son corps, puis rétablir par moitiés.
   Grossier mais décisif pour savoir si le code de l'extension est même en cause.
5. **Version de VS Code** : tester avec une version antérieure. `engines.vscode`
   est `^1.105.0` ; le poste tourne sur une version où l'ABI native a changé.

## Contexte utile

- `Launch Extension` **n'ouvre aucun dossier** → la fenêtre de test ne lit que les
  réglages **utilisateur**, jamais le `.vscode/settings.json` du dépôt.
  Piège rencontré : un réglage mis dans le dépôt n'a aucun effet sur le test.
- La fenêtre normale de travail garde l'extension **installée** active en parallèle
  de la fenêtre F5 qui charge les sources. Deux copies vivantes en même temps.
