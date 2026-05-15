import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { runTests } from "vscode-test";

async function main() {
    const testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "arduino-vscode-ide-test-user-"));
    const testExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "arduino-vscode-ide-test-ext-"));
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "./index");

        // Running tests on the specific workspace
        const testWorkspace = path.resolve(__dirname, "../../test/resources/blink")
        // Download VS Code, unzip it and run the integration test
        // Keep the test runner aligned with the extension engine because the
        // extension uses APIs such as vscode.l10n that are unavailable in 1.63.
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: "1.105.0",
            platform: process.platform === "win32" ? "win32-x64-archive" : undefined,
            launchArgs: [
                testWorkspace,
                "--disable-extensions",
                "--disable-gpu",
                "--disable-updates",
                "--disable-workspace-trust",
                "--skip-release-notes",
                "--skip-welcome",
                `--extensions-dir=${testExtensionsDir}`,
                `--user-data-dir=${testUserDataDir}`,
            ],
        });
    } catch (err) {
        // console.error("Failed to run tests", err);
        process.exit(1);
    } finally {
        fs.rmSync(testExtensionsDir, { recursive: true, force: true });
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
}

main();
