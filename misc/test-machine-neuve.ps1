# Banc d'essai « machine de lycee » : profil VS Code neuf + dossier Arduino15 neuf.
#
# Rien de l'installation existante n'est touche : ni %LOCALAPPDATA%\Arduino15,
# ni le profil VS Code habituel, ni les extensions installees. Tout vit sous
# $Base, qu'il suffit d'effacer pour revenir en arriere.
#
# Usage :
#   .\misc\test-machine-neuve.ps1                  # environnement vierge
#   .\misc\test-machine-neuve.ps1 -Scenario Nu     # poste sans aucun outil Arduino
#   .\misc\test-machine-neuve.ps1 -Scenario Deux   # deux versions du coeur avr
#   .\misc\test-machine-neuve.ps1 -Scenario Index  # index illisible
#   .\misc\test-machine-neuve.ps1 -Nettoyer        # tout effacer

param(
   [ValidateSet("Vierge", "Nu", "Deux", "Index")]
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
if (-not (Test-Path $Cli) -and $Scenario -ne "Nu") { throw "arduino-cli introuvable : $Cli" }

Write-Host "Banc d'essai : $Base" -ForegroundColor Cyan
Write-Host "Scenario     : $Scenario" -ForegroundColor Cyan

# Scenario « Nu » : le poste ne doit contenir AUCUN outil Arduino trouvable.
# L'extension cherche un CLI dans cet ordre (findUsableCli, environmentSetup.ts) :
#   1. reglages arduino.commandPath / arduino.path  -> profil neuf, donc vides
#   2. <dossier de l'extension>\arduino-cli\        -> $Ext est neuf, donc vide
#                                                      (arduino-cli/** est dans
#                                                      .vscodeignore : le paquet
#                                                      ne l'embarque pas)
#   3. resolveArduinoPath()                         -> « where arduino-cli » puis
#                                                      Arduino IDE 2
# Les candidats sont CUMULES, pas exclusifs : il ne suffit pas d'en fournir un
# mauvais, il faut que tous echouent. D'ou les verifications ci-dessous.
$EnvNu = @{}
if ($Scenario -eq "Nu") {
   $Leurre = Join-Path $Base "vide"
   New-Item -ItemType Directory -Force $Leurre | Out-Null

   # Piste 3a — PATH : toute entree exposant arduino-cli.exe est retiree.
   $EnvNu["PATH"] = ($env:PATH -split ';' |
      Where-Object { $_ -and -not (Test-Path (Join-Path $_ 'arduino-cli.exe')) }) -join ';'

   # hasCoreOnDisk() lit LOCALAPPDATA en direct pour chercher un coeur dans
   # Arduino15 : on l'envoie sur un dossier vide. Cette variable-la, contrairement
   # a ProgramFiles, se laisse bien reecrire pour un processus fils.
   $EnvNu["LOCALAPPDATA"] = $Leurre

   # Piste 3b — Arduino IDE 2. Mesure faite le 11/09/2026 : Windows REINJECTE
   # ProgramFiles dans tout processus fils, meme avec un bloc d'environnement
   # explicite (teste en PowerShell et en node). Cette variable n'est pas
   # masquable : si Arduino IDE 2 est installe, son CLI embarque sera trouve et
   # le scenario ne testerait plus rien. On refuse alors de lancer un test faux.
   $IdeCli = @(
      (Join-Path $env:ProgramFiles "Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"),
      (Join-Path ${env:ProgramFiles(x86)} "Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"),
      (Join-Path $env:LOCALAPPDATA "Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe")
   ) | Where-Object { Test-Path $_ }
   if ($IdeCli) {
      Write-Host "`nArduino IDE 2 est installe :" -ForegroundColor Red
      $IdeCli | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
      Write-Host @"

Son arduino-cli serait trouve par resolveArduinoPath(), et le scenario « poste nu »
ne testerait pas ce qu'il pretend tester. ProgramFiles n'est pas masquable : Windows
le reinjecte dans tout processus fils.

Desinstalle Arduino IDE 2 (il ne touche ni Arduino15 ni tes croquis) :
  & "`$env:ProgramFiles\Arduino IDE\Uninstall Arduino IDE.exe" /allusers

Ou lance ce scenario sur une machine qui ne l'a pas.
"@ -ForegroundColor Yellow
      throw "Scenario Nu impossible : Arduino IDE 2 present."
   }

   Write-Host "`nPoste nu : aucun CLI, aucun coeur, aucun Arduino IDE trouvable."
   Write-Host "  PATH        : $(($env:PATH -split ';').Count) entrees -> $(($EnvNu['PATH'] -split ';').Count)"
   Write-Host "  LOCALAPPDATA -> $Leurre"
   Write-Host "  Arduino IDE 2 : absent"
   Write-Host "L'extension doit proposer l'installation complete (CLI + coeur)."
}

switch ($Scenario) {
   "Vierge" {
      # Rien d'installe : on verifie que l'extension propose et reussit
      # l'installation guidee sur une machine nue.
      Write-Host "`nAucun coeur installe. L'extension doit proposer l'installation."
   }
   "Nu" {
      # Tout est fait ci-dessus : il n'y a justement rien a installer.
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

   # `--install-extension` rend la main avant que le dossier soit reellement pose
   # sur le disque. Ouvrir la fenetre tout de suite donne un hote d'extensions qui
   # echoue sur « ENOENT ... access <dossier de l'extension> » : la vue de la barre
   # laterale tourne alors dans le vide, sans fournisseur de donnees.
   $attendu = Get-ChildItem $Ext -Directory -Filter "*arduino-vscode-ide*" -ErrorAction SilentlyContinue
   $essais = 0
   while (-not ($attendu -and (Test-Path (Join-Path $attendu[0].FullName "package.json"))) -and $essais -lt 30) {
      Start-Sleep -Milliseconds 500
      $essais++
      $attendu = Get-ChildItem $Ext -Directory -Filter "*arduino-vscode-ide*" -ErrorAction SilentlyContinue
   }
   if (-not $attendu) { throw "Extension absente de $Ext apres installation." }

   $manif = Get-Content (Join-Path $attendu[0].FullName "package.json") -Raw | ConvertFrom-Json
   Write-Host "Installee : $($attendu[0].Name)  (buildNumber $($manif.buildNumber))" -ForegroundColor Green
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

if ($EnvNu.Count -gt 0) {
   # Les variables assainies ne valent que pour ce processus-ci. On sauvegarde,
   # on lance, on restaure aussitot : la session PowerShell courante ressort intacte.
   $sauve = @{}
   foreach ($k in $EnvNu.Keys) {
      $sauve[$k] = [Environment]::GetEnvironmentVariable($k)
      [Environment]::SetEnvironmentVariable($k, $EnvNu[$k])
   }
   try {
      & code --user-data-dir $Prof --extensions-dir $Ext --new-window $croquis
   } finally {
      foreach ($k in $sauve.Keys) {
         [Environment]::SetEnvironmentVariable($k, $sauve[$k])
      }
   }
} else {
   & code --user-data-dir $Prof --extensions-dir $Ext --new-window $croquis
}

Write-Host "`nA verifier dans la fenetre ouverte :" -ForegroundColor Green
if ($Scenario -eq "Nu") {
   Write-Host "  1. Un message annonce-t-il l'environnement Arduino manquant ?"
   Write-Host "     (« Arduino CLI et un coeur de carte sont necessaires... »)"
   Write-Host "  2. En acceptant : le CLI se telecharge-t-il, puis arduino:avr s'installe-t-il ?"
   Write-Host "  3. Apres installation, la barre d'etat propose-t-elle une carte ?"
   Write-Host "  4. « Arduino: Verify » compile-t-il le croquis ?"
   Write-Host "  5. En refusant : l'extension reste-t-elle utilisable, sans plantage ni vue vide ?"
} else {
   Write-Host "  1. La barre d'etat propose-t-elle une carte ?"
   Write-Host "  2. « Arduino: Board Manager » liste-t-il arduino:avr comme installe ?"
   Write-Host "  3. La version affichee est-elle bien la plus recente ?"
   Write-Host "  4. « Arduino: Verify » compile-t-il le croquis ?"
}
Write-Host "`nPour tout effacer :  .\misc\test-machine-neuve.ps1 -Nettoyer"
