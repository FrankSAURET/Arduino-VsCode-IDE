import * as assert from "assert";

import { shouldRecommend, shouldRecommendKablix } from "../src/arduino/extensionRecommendation";

suite("Arduino: extension recommendation", () => {
    test("shouldRecommendKablix is the shared implementation", () => {
        assert.equal(shouldRecommendKablix, shouldRecommend);
    });

    test("should recommend C/C++ only when it is missing", () => {
        assert.equal(shouldRecommend(false, "2026.8.0", undefined), true);
        assert.equal(shouldRecommend(true, "2026.8.0", undefined), false);
    });
});

suite("Arduino: Kablix recommendation", () => {
    test("should recommend on first launch", () => {
        assert.equal(shouldRecommendKablix(false, "2026.7.5", undefined), true);
        assert.equal(shouldRecommendKablix(false, "2026.7.5", {}), true);
    });

    test("should recommend again after an update", () => {
        assert.equal(shouldRecommendKablix(false, "2026.7.5", { lastShownVersion: "2026.7.4" }), true);
    });

    test("should not recommend twice for the same version", () => {
        assert.equal(shouldRecommendKablix(false, "2026.7.5", { lastShownVersion: "2026.7.5" }), false);
    });

    test("should not recommend when Kablix is installed", () => {
        assert.equal(shouldRecommendKablix(true, "2026.7.5", undefined), false);
        assert.equal(shouldRecommendKablix(true, "2026.7.5", { lastShownVersion: "2026.7.4" }), false);
    });

    test("should not recommend after a permanent dismissal, even on a new version", () => {
        assert.equal(shouldRecommendKablix(false, "2026.7.5", { lastShownVersion: "2026.7.4", dismissedForever: true }), false);
    });

    test("should not recommend without a known extension version", () => {
        assert.equal(shouldRecommendKablix(false, "", undefined), false);
    });
});
