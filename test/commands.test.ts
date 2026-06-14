//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as util from "../src/common/util";

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTestPath(filePath: string | undefined): string | undefined {
    if (!filePath) {
        return filePath;
    }
    const normalized = path.normalize(filePath);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

// Defines a Mocha test suite to group tests of similar kind together
suite("Arduino: Commands Tests", () => {
    // tslint:disable-next-line: only-arrow-functions
    setup(function(done) {
        // Ensure that extension is activate while testing
       this.timeout(60 * 1000);
       const extension = vscode.extensions.getExtension("electropol-fr.arduino-vscode-ide");
       if (!extension.isActive) {
            extension.activate().then((api) => {
                // The extension waits 100ms before registering some commands,
                // so add a longer delay here before running tests.
                setTimeout(() => done(), 200);
            }, () => {
                done("Failed to activate extension");
            });
        } else {
            setTimeout(() => done(), 200);
        }
    });

    // Arduino: Initialize：Scaffold a VS Code project with an Arduino sketch.
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to run command: arduino.initialize", async function() {
        this.timeout(60 * 1000);
        const windowAny = vscode.window as any;
        const commandsAny = vscode.commands as any;
        const originalShowOpenDialog = windowAny.showOpenDialog;
        const originalShowInputBox = windowAny.showInputBox;
        const originalExecuteCommand = commandsAny.executeCommand;
        const parentFolder = fs.mkdtempSync(path.join(os.tmpdir(), "arduino-vscode-ide-init-"));
        const projectName = "InitProject";
        const projectFolder = path.join(parentFolder, projectName);
        let openedFolder: string | undefined;

        try {
            windowAny.showOpenDialog = async () => [vscode.Uri.file(parentFolder)];
            windowAny.showInputBox = async () => projectName;
            commandsAny.executeCommand = async (command: string, ...args: any[]) => {
                if (command === "vscode.openFolder") {
                    openedFolder = args[0].fsPath;
                    return undefined;
                }
                return originalExecuteCommand.apply(vscode.commands, [command, ...args]);
            };

            await originalExecuteCommand.apply(vscode.commands, ["arduino.initialize"]);
            await delay(50);

            assert.equal(normalizeTestPath(openedFolder), normalizeTestPath(projectFolder));
            assert.equal(fs.existsSync(path.join(projectFolder, `${projectName}.ino`)), true);
            assert.equal(fs.existsSync(path.join(projectFolder, ".vscode", "arduino.yaml")), true);
        } finally {
            commandsAny.executeCommand = originalExecuteCommand;
            windowAny.showOpenDialog = originalShowOpenDialog;
            windowAny.showInputBox = originalShowInputBox;
            if (util.directoryExistsSync(parentFolder)) {
                util.rmdirRecursivelySync(parentFolder);
            }
        }
    });

    // Arduino: Boards Manager : Manage packages for boards
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to run command: arduino.showBoardManager", function(done) {
        this.timeout(60 * 1000);
        try {
            // run "Arduino: Boards Manager" command.
            vscode.commands.executeCommand("arduino.showBoardManager").then((result)  => {
                done();
            });

        } catch (error) {
            done(new Error(error));
        }
    });

    // Arduino: Libraries Manager: Explore and manage libraries
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to run command: arduino.showLibraryManager", function(done) {
        this.timeout(10 * 1000);
        try {
            // run "Arduino: Libraries Manager" command.
            vscode.commands.executeCommand("arduino.showLibraryManager").then((result)  => {
                done();
            });

        } catch (error) {
            done(new Error(error));
        }
    });

    // Arduino: Arduino Board Configuration
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to run command: arduino.showBoardConfig", function(done) {
        this.timeout(10 * 1000);
        try {
            // run "Arduino: Arduino Board Configuration" command.
            vscode.commands.executeCommand("arduino.showBoardConfig").then((result)  => {
                done();
            });

        } catch (error) {
            done(new Error(error));
        }
    });

    // Arduino: Examples: Show example list
    // tslint:disable-next-line: only-arrow-functions
    test("should be able to run command: arduino.showExamples", function(done) {
        this.timeout(10 * 1000);
        try {
            // run "Arduino: Examples" command.
            vscode.commands.executeCommand("arduino.showExamples").then((result)  => {
                done();
            });

        } catch (error) {
            done(new Error(error));
        }
    });

});
