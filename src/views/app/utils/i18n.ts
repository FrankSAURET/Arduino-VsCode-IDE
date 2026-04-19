// Copyright (c) Electropol. All rights reserved.
// Licensed under the MIT license.

const translations: { [locale: string]: { [key: string]: string } } = {
    fr: {
        // Board Manager
        "Board Manager": "Gestionnaire de cartes",
        "Refresh Package Indexes": "Rafraîchir les index de paquets",
        "Configure Additional Boards Manager URLs": "Configurer des URLs supplémentaires du gestionnaire de cartes",
        "Additional URLs": "URLs supplémentaires",
        "Total {0} Boards": "{0} cartes au total",
        "{0} Boards matched": "{0} cartes trouvées",

        // Board Item
        "Built-In": "Intégré",
        "by": "par",
        "Version": "Version",
        "INSTALLED": "INSTALLÉ",
        "Online help": "Aide en ligne",
        "More info": "Plus d'infos",
        "Boards included in this package:": "Cartes incluses dans ce paquet :",
        "Installing...": "Installation...",
        "Removing...": "Suppression...",
        "Removing": "Suppression",
        "Update": "Mettre à jour",
        "Remove": "Supprimer",
        "Select version": "Sélectionner la version",
        "Install": "Installer",

        // Library Manager
        "Library Manager": "Gestionnaire de bibliothèques",
        "Topic": "Catégorie",
        "Only show libraries supported by current board": "Afficher uniquement les bibliothèques compatibles avec la carte actuelle",
        "Refresh Library Index": "Rafraîchir l'index des bibliothèques",
        "Total {0} Libraries": "{0} bibliothèques au total",
        "{0} Libraries matched": "{0} bibliothèques trouvées",

        // Library Item
        "Unknown": "Inconnue",
        "Include Library": "Inclure la bibliothèque",

        // Board Selector
        "Board Selector": "Sélecteur de carte",
        "Selected Board:": "Carte sélectionnée :",
        "Select your board": "Sélectionnez votre carte",

        // Board Config
        "Select option": "Sélectionner une option",

        // Examples
        "Examples": "Exemples",

        // Common
        "Loading...": "Chargement...",
        "Type": "Type",
        "Filter your search...": "Filtrer votre recherche...",

        // Filter categories
        "All": "Tous",
        "Updatable": "Mises à jour disponibles",
        "Installed": "Installé",
        "Uncategorized": "Non catégorisé",
    },
};

function getLocale(): string {
    // Try URL parameter first (passed by content provider)
    try {
        const params = new URLSearchParams(window.location.search);
        const urlLocale = params.get("locale");
        if (urlLocale) {
            return urlLocale.substring(0, 2);
        }
    } catch (e) {
        // ignore
    }
    // Fallback to browser/Electron language
    if (typeof navigator !== "undefined" && navigator.language) {
        return navigator.language.substring(0, 2);
    }
    return "en";
}

const locale = getLocale();

export function t(key: string, ...args: any[]): string {
    const dict = translations[locale];
    let result = (dict && dict[key]) || key;
    args.forEach((arg, i) => {
        result = result.replace(`{${i}}`, String(arg));
    });
    return result;
}
