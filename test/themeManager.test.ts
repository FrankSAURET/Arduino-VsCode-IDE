import * as assert from "assert";

import { findThemeExtensionId, getRecommendedThemeExtensionId } from "../src/arduino/themeManager";

suite("Arduino: Theme Manager", () => {
    test("should recommend the Arduino theme pack for supported themes", () => {
        assert.equal(getRecommendedThemeExtensionId("Arduino"), "oscarewenstudent.arduino-themes-vsc");
        assert.equal(getRecommendedThemeExtensionId("Arduino Light"), "oscarewenstudent.arduino-themes-vsc");
        assert.equal(getRecommendedThemeExtensionId("Arduino Dark"), "oscarewenstudent.arduino-themes-vsc");
        assert.equal(getRecommendedThemeExtensionId("Default Dark+"), undefined);
    });

    test("should resolve a theme contributor from the theme label", () => {
        const extensionId = findThemeExtensionId("Arduino Light", [
            {
                id: "publisher.theme-pack",
                packageJSON: {
                    contributes: {
                        themes: [
                            { label: "Arduino Light" },
                        ],
                    },
                },
            },
        ]);

        assert.equal(extensionId, "publisher.theme-pack");
    });

    test("should resolve a theme contributor from the theme id", () => {
        const extensionId = findThemeExtensionId("Arduino Dark", [
            {
                id: "publisher.theme-pack",
                packageJSON: {
                    contributes: {
                        themes: [
                            { id: "Arduino Dark" },
                        ],
                    },
                },
            },
        ]);

        assert.equal(extensionId, "publisher.theme-pack");
    });
});