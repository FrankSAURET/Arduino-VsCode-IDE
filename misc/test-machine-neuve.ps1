# Banc d'essai « machine de lycee » : profil VS Code neuf + dossier Arduino15 neuf.
#
# Rien de l'installation existante n'est touche : ni %LOCALAPPDATA%\Arduino15,
# ni le profil VS Code habituel, ni les extensions installees. Tout vit sous
# $Base, qu'il suffit d'effacer pour revenir en arriere.
#
# Usage :
#   .\misc\test-machine-neuve.ps1                  # environnement vierge
#   .\misc\test-machine-neuve.ps1 -Scenario Deux   # deux versions du coeur avr
#   .\misc\test-machine-neuve.ps1 -Scenario Index  # index illisible
#   .\misc\test-machine-neuve.ps1 -Nettoyer        # tout effacer

param(
   [ValidateSet("Vierge", "Deux", "Index")]
   [string] $Scenario = "Vierge",
   [string] $Base = "V:\Temp\arduino-lycee",
   [string] $Vsix = "",
   [switch] $Nettoyer
)

$ErrorActionPreference = "Stop"
$Projet = Split-Path -Parent $PSScriptRoot

if ($Nettoyer) {
   if (Test-Path $Base) {
      try {
         Remove-Item -Recurse -Force $Base -ErrorAction Stop
      } catch {
         # La fenetre VS Code du banc d'essai tient encore ses fichiers de cache.
         Write-Host "Des fichiers sont verrouilles : ferme la fenetre VS Code du banc d'essai." -ForegroundColor Yellow
         Write-Host "Nouvelle tentative..." -ForegroundColor Yellow
         Start-Sleep -Seconds 2
         Remove-Item -Recurse -Force $Base -ErrorAction SilentlyContinue
      }
   }
   if (Test-Path $Base) {
      Write-Host "Reste : $Base — relance apres avoir ferme la fenetre." -ForegroundColor Yellow
   } else {
      Write-Host "Banc d'essai efface : $Base" -ForegroundColor Green
   }
   Write-Host "Ton installation reelle n'a jamais ete touchee."
   return
}

$Data = Join-Path $Base "data"       # remplace %LOCALAPPDATA%\Arduino15
$User = Join-Path $Base "user"       # remplace Documents\Arduino
$Prof = Join-Path $Base "vscode"     # profil VS Code (reglages, etat)
$Ext  = Join-Path $Base "ext"        # extensions

foreach ($d in @($Data, $User, $Prof, $Ext)) {
   New-Item -ItemType Directory -Force $d | Out-Null
}

# Le CLI lit ces deux variables : il ecrit alors dans le banc d'essai,
# jamais dans le vrai Arduino15.
$env:ARDUINO_DIRECTORIES_DATA = $Data
$env:ARDUINO_DIRECTORIES_USER = $User

$Cli = Join-Path $Projet "arduino-cli\arduino-cli.exe"
if (-not (Test-Path $Cli)) { throw "arduino-cli introuvable : $Cli" }

Write-Host "Banc d'essai : $Base" -ForegroundColor Cyan
Write-Host "Scenario     : $Scenario" -ForegroundColor Cyan

switch ($Scenario) {
   "Vierge" {
      # Rien d'installe : on verifie que l'extension propose et reussit
      # l'installation guidee sur une machine nue.
      Write-Host "`nAucun coeur installe. L'extension doit proposer l'installation."
   }
   "Deux" {
      # Le cas du lycee : deux versions du coeur cote a cote.
      #
      # Mesure faite le 11/09/2026 : `core install` REMPLACE la version, il n'en
      # laisse qu'un seul dossier. La cohabitation vient donc d'ailleurs — mise a
      # jour interrompue, copie d'un dossier Arduino15 d'une machine a l'autre,
      # restauration partielle, ou installation faite par l'IDE Arduino a cote du
      # CLI. On la recree ici a la main, c'est l'etat observe qui compte.
      Write-Host "`nInstallation de arduino:avr 1.8.8..."
      & $Cli core update-index | Out-Null
      & $Cli core install arduino:avr@1.8.8 | Out-Null
      $avr = Join-Path $Data "packages\arduino\hardware\avr"
      $v187 = Join-Path $avr "1.8.7"
      $v188 = Join-Path $avr "1.8.8"
      if ((Test-Path $v188) -and -not (Test-Path $v187)) {
         Copy-Item -Recurse $v188 $v187
      }
      Write-Host "Versions presentes : $((Get-ChildItem $avr).Name -join ', ')" -ForegroundColor Yellow
      Write-Host "Le CLI, lui, utilise :" -ForegroundColor Yellow
      & $Cli core list | Select-Object -First 2
      Write-Host "Avant correctif l'extension prenait 1.8.7, le CLI 1.8.8 : d'ou la panne."
   }
   "Index" {
      # Index present mais inexploitable : le cas « portail captif ».
      Write-Host "`nInstallation de arduino:avr, puis sabotage de l'index..."
      & $Cli core update-index | Out-Null
      & $Cli core install arduino:avr | Out-Null
      $idx = Join-Path $Data "package_index.json"
      Set-Content -Path $idx -Value "<html><body>Portail captif</body></html>" -Encoding utf8
      Write-Host "package_index.json remplace par une page HTML." -ForegroundColor Yellow
   }
}

if ($Vsix) {
   if (-not (Test-Path $Vsix)) { throw "Paquet introuvable : $Vsix" }
   Write-Host "`nInstallation de l'extension dans le profil neuf..."
   & code --user-data-dir $Prof --extensions-dir $Ext --install-extension $Vsix
}

Write-Host "`nOuverture de VS Code (profil neuf)..." -ForegroundColor Cyan
$croquis = Join-Path $User "test-lycee"
New-Item -ItemType Directory -Force $croquis | Out-Null
$ino = Join-Path $croquis "test-lycee.ino"
if (-not (Test-Path $ino)) {
   Set-Content -Path $ino -Encoding utf8 -Value @'
void setup() {
   pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
   digitalWrite(LED_BUILTIN, HIGH);
   delay(500);
   digitalWrite(LED_BUILTIN, LOW);
   delay(500);
}
'@
}

& code --user-data-dir $Prof --extensions-dir $Ext --new-window $croquis

Write-Host "`nA verifier dans la fenetre ouverte :" -ForegroundColor Green
Write-Host "  1. La barre d'etat propose-t-elle une carte ?"
Write-Host "  2. « Arduino: Board Manager » liste-t-il arduino:avr comme installe ?"
Write-Host "  3. La version affichee est-elle bien la plus recente ?"
Write-Host "  4. « Arduino: Verify » compile-t-il le croquis ?"
Write-Host "`nPour tout effacer :  .\misc\test-machine-neuve.ps1 -Nettoyer"
