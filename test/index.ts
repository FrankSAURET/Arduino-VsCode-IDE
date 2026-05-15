import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";

export function run(): Promise<void> {
    // Create the mocha test
    const grep = process.env.MOCHA_GREP ? new RegExp(process.env.MOCHA_GREP) : undefined;
    const mochaOptions: Mocha.MochaOptions = {
        ui: "tdd",
        grep,
    };
    if (process.env.MOCHA_INVERT === "1") {
        (mochaOptions as any).invert = true;
    }
    const mocha = new Mocha(mochaOptions);
    mocha.useColors(true);

    const testsRoot = path.resolve(__dirname, "..");

    return new Promise((c, e) => {
        glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                // console.error(err);
                e(err);
            }
        });
    });
}
