//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
const impor = require("impor")(__dirname);

// Defines a Mocha test suite to group tests of similar kind together
suite("Arduino: Extension Tests", () => {
    test("should be present", () => {
        assert.ok(vscode.extensions.getExtension("electropol-fr.arduino-vscode-ide"));
    });

    // The extension is already activated by vscode before running mocha test framework.
    // No need to test activate any more. So commenting this case.
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to activate the extension", function(done) {
        this.timeout(60 * 1000);
        const extension = vscode.extensions.getExtension("electropol-fr.arduino-vscode-ide");
        if (!extension.isActive) {
            extension.activate().then((api) => {
                done();
            }, () => {
                done("Failed to activate extension");
            });
        } else {
            done();
        }
    });

    test("should be able to register arduino commands", async () => {
            await new Promise((resolve) => setTimeout(resolve, 300));

            const commands = await vscode.commands.getCommands(true);
            const manifest = require(path.resolve(__dirname, "../../package.json"));
            const expectedCommands = Array.from(new Set([
                ...manifest.contributes.commands.map((commandContribution) => commandContribution.command),
                "arduino.openExample",
                "arduino.loadPackages",
                "arduino.installBoard",
                "arduino.reloadExample",
            ])).sort();

            const foundArduinoCommands = commands.filter((value) => value.startsWith("arduino.")).sort();

            const errorMsg = "Some Arduino commands are not registered properly or a new command is not added to the test";
            assert.deepStrictEqual(foundArduinoCommands, expectedCommands, errorMsg);
        });

    suiteTeardown(() => {
        // Test window cleanup - nothing to do here
    });
});
