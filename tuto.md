# Tuto : démarrer un projet Arduino avec l'extension

Ce tutoriel explique le chemin le plus simple pour créer un projet Arduino dans VS Code avec cette extension, puis le vérifier, l'uploader et utiliser le moniteur série.

Il s'appuie sur le README de ce fork et sur le fonctionnement de l'extension Microsoft d'origine. La différence importante est que ce fork privilégie Arduino CLI par défaut et peut proposer son téléchargement automatique s'il n'est pas trouvé.

## 1. Pré-requis

Avant de commencer, il faut :

- VS Code
- L'extension Arduino installée
- Arduino CLI
- Une carte Arduino et, si nécessaire, son câble USB

### Arduino CLI

L'interface arduino utilisée est Arduino CLI.

- Dans ce fork, l'extension utilise Arduino CLI uniquement.
- Si `arduino-cli` n'est pas trouvé, l'extension peut proposer de le télécharger automatiquement.
- Si vous utilisez une installation manuelle, laissez `arduino-cli` dans le `PATH` ou configurez `arduino.path` vers le dossier qui contient l'exécutable.
- Vous pouvez aussi pointer vers un fichier local `arduino-cli.yaml` avec `arduino.arduinoCliConfigFile`.

## 2. Créer le dossier du projet

Créez un dossier vide pour votre sketch, puis ouvrez ce dossier dans VS Code.

Exemple :

```text
MonProjetBlink/
```

Travaillez de préférence avec un dossier dédié par sketch. L'extension stocke la configuration du projet dans `.vscode/arduino.json`.

## 3. Initialiser le projet

Ouvrez la palette de commandes, puis lancez :

```text
Arduino: Initialize
```

Ce que fait la commande d'initialisation :

- elle prépare le dossier comme projet Arduino pour VS Code ;
- si aucun fichier `.ino` n'existe, elle demande un nom de sketch, par défaut `sketch.ino` ;
- elle crée un squelette minimal avec `setup()` et `loop()` ;
- elle renseigne la configuration du projet ;
- elle définit aussi un dossier de build nommé `build` pour éviter des reconstructions lentes.

Le squelette généré ressemble à ceci :

```cpp
void setup()
{
	
}

void loop()
{
	
}
```

Après initialisation, vous aurez en général une structure proche de :

```text
MonProjetBlink/
├─ sketch.ino
└─ .vscode/
   └─ arduino.json
```

## 4. Configurer la carte et le port

Une fois le projet initialisé, renseignez au minimum la carte cible, puis le port série si vous voulez uploader.

Commandes utiles :

- `Arduino: Change Board Type`
- `Arduino: Select Serial Port`
- `Arduino: Board Manager`

Si votre carte n'est pas encore installée :

1. Lancez `Arduino: Board Manager`.
2. Installez le package correspondant à votre carte.
3. Relancez `Arduino: Change Board Type`.

Pour certaines cartes tierces, ajoutez au préalable leurs URL dans `arduino.additionalUrls`.

## 5. Comprendre .vscode/arduino.json

Le fichier `.vscode/arduino.json` contient la configuration du sketch courant.

Exemple minimal :

```json
{
    "sketch": "sketch.ino",
    "port": "COM5",
    "board": "arduino:avr:uno",
    "output": "build"
}
```

Champs les plus utiles :

- `sketch` : fichier principal du sketch
- `port` : port série utilisé pour l'upload
- `board` : identifiant complet de la carte
- `output` : dossier de build
- `configuration` : options de carte si la plateforme en propose
- `prebuild` : commande lancée avant compilation
- `postbuild` : commande lancée après compilation réussie
- `buildPreferences` : préférences Arduino injectées dans le build

Point important sur `output` :

- il est conseillé de le définir ;
- évitez un dossier sensible ;
- le contenu peut être régénéré ou supprimé pendant les builds.

## 6. Écrire un premier sketch

Exemple minimal pour faire clignoter la LED intégrée :

```cpp
void setup()
{
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop()
{
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
```

Enregistrez le fichier avant de lancer une compilation.

## 7. Vérifier le projet

Pour compiler sans uploader :

- commande : `Arduino: Verify`
- raccourci : `Ctrl+Alt+R`

La vérification sert à confirmer que :

- la carte sélectionnée est correcte ;
- les dépendances sont disponibles ;
- le code compile.

Si la compilation échoue, vérifiez d'abord :

- le backend utilisé, CLI ou IDE ;
- la carte choisie ;
- les bibliothèques requises ;
- le contenu de `.vscode/arduino.json`.

## 8. Uploader sur la carte

Pour compiler puis envoyer le binaire sur la carte :

- commande : `Arduino: Upload`
- raccourci : `Ctrl+Alt+U`

Avant l'upload, assurez-vous que :

- la carte est bien connectée ;
- le bon port est sélectionné ;
- aucun programme n'occupe le port série.

Autres commandes utiles :

- `Arduino: CLI Upload` : upload sans rebuild, en mode CLI
- `Arduino: Upload Using Programmer`
- `Arduino: CLI Upload Using Programmer`

## 9. Utiliser le moniteur série

Pour lire les sorties `Serial.print` :

1. Lancez `Arduino: Open Serial Monitor`.
2. Réglez la vitesse avec `Arduino: Change Baud Rate`.
3. Fermez le moniteur avant certains uploads si la carte ou le port le nécessite.

Réglages utiles :

- `arduino.defaultBaudRate`
- `arduino.defaultTimestampFormat`

## 10. IntelliSense et auto-configuration

L'extension peut générer automatiquement la configuration IntelliSense à partir de la sortie du compilateur.

Commande utile :

```text
Arduino: Rebuild IntelliSense Configuration
```

Utilisez-la si :

- les includes sont soulignés à tort ;
- vous venez d'ajouter une bibliothèque ;
- vous avez changé de carte ou de sketch ;
- `c_cpp_properties.json` semble désynchronisé.

Le nom de configuration attendu côté C/C++ est généralement `Arduino`.

## 11. Démarrage rapide en 30 secondes

Si vous voulez aller au plus vite :

1. Ouvrez un dossier vide dans VS Code.
2. Lancez `Arduino: Initialize`.
3. Choisissez ou créez votre fichier `sketch.ino`.
4. Lancez `Arduino: Board Manager` si votre carte n'est pas encore installée.
5. Lancez `Arduino: Change Board Type`.
6. Lancez `Arduino: Select Serial Port`.
7. Écrivez votre code.
8. Lancez `Arduino: Verify`.
9. Lancez `Arduino: Upload`.

## 12. Si vous préférez créer le projet manuellement

Vous pouvez aussi partir d'un dossier contenant déjà un `.ino`, puis créer vous-même `.vscode/arduino.json`.

Exemple :

```json
{
    "sketch": "monprojet.ino",
    "port": "COM5",
    "board": "arduino:avr:uno",
    "output": "build"
}
```

C'est utile si vous importez un projet existant ou si vous voulez garder la main sur la structure du dépôt.

## 13. Problèmes fréquents

### La carte n'apparaît pas

- Installez son package via `Arduino: Board Manager`.
- Ajoutez les URL nécessaires dans `arduino.additionalUrls` pour les plateformes tierces.

### Le port série n'apparaît pas

- Vérifiez le câble USB.
- Vérifiez le pilote de la carte.
- Rebranchez la carte.
- Fermez toute application qui utilise déjà le port.

### La compilation est lente

- définissez `output` dans `.vscode/arduino.json` ;
- gardez un dossier de build stable, par exemple `build`.

### IntelliSense ne suit pas

- relancez `Arduino: Rebuild IntelliSense Configuration` ;
- vérifiez que l'extension C/C++ est installée ;
- contrôlez que la configuration `Arduino` est bien sélectionnée.

## 14. Commandes à retenir

- `Arduino: Initialize`
- `Arduino: Board Manager`
- `Arduino: Change Board Type`
- `Arduino: Select Serial Port`
- `Arduino: Verify`
- `Arduino: Upload`
- `Arduino: Open Serial Monitor`
- `Arduino: Rebuild IntelliSense Configuration`

## 15. Résumé

Le flux standard pour démarrer un projet est simple :

1. ouvrir un dossier vide ;
2. lancer `Arduino: Initialize` ;
3. choisir la carte et le port ;
4. vérifier ;
5. uploader.

Pour les nouveaux projets, Arduino CLI est aujourd'hui le meilleur choix avec ce fork.