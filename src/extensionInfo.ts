// Acces centralise aux informations du manifeste de l'extension et a son mode
// d'execution. Les deux sont memorises a l'activation (voir extension.ts) :
// le contexte fourni par VS Code est la seule source fiable, la recherche par
// identifiant echouant des que l'extension tourne sous un autre nom d'editeur.
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export const EXTENSION_ID = "electropol-fr.arduino-vscode-ide";

let extensionMode: vscode.ExtensionMode | undefined;
let packageJSON: any;
let globalStoragePath: string = "";

/**
 * Memorise le mode d'execution et le manifeste fournis a l'activation.
 *
 * Le manifeste expose par `context.extension.packageJSON` est filtre par VS Code :
 * il n'en garde que les champs du schema officiel. Nos champs maison — `buildNumber`
 * en tete — en sont absents. Le manifeste du disque est donc relu et fusionne par
 * dessous : l'objet de VS Code reste prioritaire (il porte les valeurs effectivement
 * retenues par l'hote), le disque ne comble que ce qui manque.
 */
export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionMode = context.extensionMode;
    globalStoragePath = context.globalStorageUri?.fsPath || "";

    let onDisk: any;
    try {
        onDisk = JSON.parse(fs.readFileSync(path.join(context.extensionPath, "package.json"), "utf8"));
    } catch (error) {
        onDisk = undefined;
    }

    const provided = (context as any).extension?.packageJSON;
    if (provided && onDisk) {
        packageJSON = { ...onDisk, ...provided };
    } else {
        packageJSON = provided || onDisk;
    }
}

/**
 * Vrai quand l'extension tourne en production (installee par l'utilisateur).
 * Faux en developpement ou en test. En l'absence d'information, on suppose
 * la production pour ne rien divulguer d'interne.
 */
export function isProductionMode(): boolean {
    return extensionMode === undefined || extensionMode === vscode.ExtensionMode.Production;
}

/**
 * Dossier de stockage persistant de l'extension, ou "" hors activation.
 * Contrairement au dossier de l'extension, il survit aux mises a jour : c'est la
 * qu'on range ce qu'on ne veut pas retelecharger a chaque version (arduino-cli).
 * Il reste propre a l'utilisateur ET a l'editeur (VS Code, VSCodium...), un
 * emplacement partage par toute la machine demandant les droits administrateur.
 */
export function getGlobalStoragePath(): string {
    return globalStoragePath;
}

/** Contenu du package.json de l'extension, ou un objet vide si introuvable. */
export function getExtensionPackageJSON(): any {
    return packageJSON || vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON || {};
}
