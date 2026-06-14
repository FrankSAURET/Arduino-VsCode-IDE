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
        assert.equal(deviceContext.output, null);
        assert.equal(deviceContext.debugger_, null);
        assert.equal(deviceContext.programmer, "unknown:programmer");
    });
});
