import * as assert from "assert";

import { DeviceContext } from "../src/deviceContext";

suite("Arduino: Device Context config", () => {

    test("should be able to resolve arduino.yaml correctly", async () => {
        const deviceContext = DeviceContext.getInstance();
        await deviceContext.loadContext();
        assert.equal(deviceContext.board, "arduino:avr:diecimila");
        assert.equal(deviceContext.port, "COM4");
        assert.equal(deviceContext.sketch, "blink.ino");
        assert.equal(deviceContext.configuration, "cpu=atmega328");
        // Dossier de sortie par defaut applique meme si arduino.yaml ne le precise pas
        assert.equal(deviceContext.output, ".build");
        assert.equal(deviceContext.debugger_, null);
        assert.equal(deviceContext.programmer, "unknown:programmer");
    });
});
