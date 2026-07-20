import * as assert from "assert";

import { canStoreArduinoThemeLocally, findThemeExtensionId, getRecommendedThemeExtensionId, resolveArduinoTheme } from "../src/arduino/themeManager";

const COLORED_THEME = {
    id: "electropol-fr.coloredtheme",
    packageJSON: {
        contributes: {
            themes: [
                { label: "Arduino light" },
                { label: "Arduino dark" },
            ],
        },
    },
};

const LEGACY_THEME_PACK = {
    id: "oscarewenstudent.arduino-themes-vsc",
    packageJSON: {
        contributes: {
            themes: [
                { label: "Arduino" },
                { label: "Arduino Light" },
                { label: "Arduino Dark" },
            ],
        },
    },
};

suite("Arduino: Theme Manager", () => {
    test("should recommend the Colored Theme extension for supported themes", () => {
        assert.equal(getRecommendedThemeExtensionId("Arduino light"), "electropol-fr.coloredtheme");
        assert.equal(getRecommendedThemeExtensionId("Arduino dark"), "electropol-fr.coloredtheme");
        assert.equal(getRecommendedThemeExtensionId("Default Dark+"), undefined);
    });

    // Les anciens libellés doivent rester reconnus, sinon leur désinstallation
    // ne déclencherait plus aucune proposition d'installation.
    test("should recommend the Colored Theme extension for legacy theme names", () => {
        assert.equal(getRecommendedThemeExtensionId("Arduino"), "electropol-fr.coloredtheme");
        assert.equal(getRecommendedThemeExtensionId("Arduino Light"), "electropol-fr.coloredtheme");
        assert.equal(getRecommendedThemeExtensionId("Arduino Dark"), "electropol-fr.coloredtheme");
    });

    test("should keep a Colored Theme name untouched", () => {
        assert.equal(resolveArduinoTheme("Arduino light", [COLORED_THEME]), "Arduino light");
        assert.equal(resolveArduinoTheme("Arduino dark", [COLORED_THEME]), "Arduino dark");
    });

    test("should keep the legacy theme when only the legacy pack is installed", () => {
        assert.equal(resolveArduinoTheme("Arduino Light", [LEGACY_THEME_PACK]), "Arduino Light");
        assert.equal(resolveArduinoTheme("Arduino Dark", [LEGACY_THEME_PACK]), "Arduino Dark");
        assert.equal(resolveArduinoTheme("Arduino", [LEGACY_THEME_PACK]), "Arduino");
    });

    test("should prefer Colored Theme when both extensions are installed", () => {
        assert.equal(resolveArduinoTheme("Arduino Light", [LEGACY_THEME_PACK, COLORED_THEME]), "Arduino light");
        assert.equal(resolveArduinoTheme("Arduino Dark", [LEGACY_THEME_PACK, COLORED_THEME]), "Arduino dark");
        // L'ancien thème "Arduino" n'a pas d'équivalent : on retombe sur le thème clair.
        assert.equal(resolveArduinoTheme("Arduino", [LEGACY_THEME_PACK, COLORED_THEME]), "Arduino light");
    });

    test("should target Colored Theme when no theme extension is installed", () => {
        assert.equal(resolveArduinoTheme("Arduino Light", []), "Arduino light");
        assert.equal(resolveArduinoTheme("Arduino Dark", []), "Arduino dark");
        assert.equal(resolveArduinoTheme("Arduino", []), "Arduino light");
    });

    test("should resolve a theme contributor from the theme label", () => {
        const extensionId = findThemeExtensionId("Arduino light", [
            {
                id: "publisher.theme-pack",
                packageJSON: {
                    contributes: {
                        themes: [
                            { label: "Arduino light" },
                        ],
                    },
                },
            },
        ]);

        assert.equal(extensionId, "publisher.theme-pack");
    });

    test("should resolve a theme contributor from the theme id", () => {
        const extensionId = findThemeExtensionId("Arduino dark", [
            {
                id: "publisher.theme-pack",
                packageJSON: {
                    contributes: {
                        themes: [
                            { id: "Arduino dark" },
                        ],
                    },
                },
            },
        ]);

        assert.equal(extensionId, "publisher.theme-pack");
    });

    test("should only allow local theme storage when a workspace is open", () => {
        assert.equal(canStoreArduinoThemeLocally(false, 0), false);
        assert.equal(canStoreArduinoThemeLocally(true, 0), true);
        assert.equal(canStoreArduinoThemeLocally(false, 1), true);
    });
});
