import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { checkUploadPort,
         ensureUploadPort,
         isBoardNotRespondingLine,
         IUploadPortUi,
         UploadAbort } from "../src/arduino/uploadPort";
import { ISerialPortDetail } from "../src/common/portList";
import * as util from "../src/common/util";

/** Port USB tel que le rend serialport (VID/PID renseignés). */
const usb = (port: string): ISerialPortDetail => ({ port, desc: "Arduino", vendorId: "2341", productId: "0043" });
/** Port sans VID/PID : COM1 de la carte mère, port Bluetooth. */
const bare = (port: string): ISerialPortDetail => ({ port, desc: "Communications Port", vendorId: undefined, productId: undefined });

/** Interface simulée : consigne chaque fenêtre posée et répond selon le scénario. */
class FakeUi implements IUploadPortUi {
    public asked: Array<{ message: string; buttons: string[] }> = [];
    public picked = 0;

    constructor(public port: string | undefined,
                public ports: ISerialPortDetail[] | undefined,
                private answers: Array<string | undefined>,
                private pickResult?: string) {
    }

    public getPort() { return this.port; }
    public setPort(port: string) { this.port = port; }
    public async listPorts() { return this.ports; }
    public async ask(message: string, buttons: string[]) {
        this.asked.push({ message, buttons });
        return this.answers.shift();
    }
    public async pickPort() {
        this.picked++;
        if (this.pickResult) {
            this.port = this.pickResult;
        }
        return this.pickResult;
    }
}

suite("Arduino: upload port check", () => {
    test("empty port is reported missing", () => {
        assert.deepEqual(checkUploadPort("", [bare("COM1")]), { status: "missing", candidate: undefined });
        assert.deepEqual(checkUploadPort(undefined, []), { status: "missing", candidate: undefined });
    });

    test("port not in the list is reported absent", () => {
        // Le COM1 écrit en dur par l'ancien échafaudage des exemples, ou une carte débranchée.
        assert.equal(checkUploadPort("COM9", [bare("COM1"), usb("COM5"), usb("COM6")]).status, "absent");
        assert.equal(checkUploadPort("/dev/ttyUSB0", []).status, "absent");
    });

    test("connected port is accepted, COM case ignored", () => {
        assert.deepEqual(checkUploadPort("COM5", [usb("COM5")]), { status: "ok" });
        assert.deepEqual(checkUploadPort("com5", [usb("COM5")]), { status: "ok" });
        assert.deepEqual(checkUploadPort("\\\\.\\COM12", [usb("COM12")]), { status: "ok" });
    });

    test("the only USB port is offered for an empty or absent port", () => {
        assert.deepEqual(checkUploadPort("", [bare("COM1"), usb("COM5")]), { status: "missing", candidate: "COM5" });
        assert.deepEqual(checkUploadPort("COM3", [bare("COM1"), usb("COM5")]), { status: "absent", candidate: "COM5" });
    });

    test("no candidate when several USB ports are present", () => {
        assert.equal(checkUploadPort("", [usb("COM5"), usb("COM6")]).candidate, undefined);
    });

    test("network ports and unreadable port lists are left to arduino-cli", () => {
        // Téléversement OTA d'un ESP32 : l'adresse IP ne figure jamais parmi les ports série.
        assert.deepEqual(checkUploadPort("192.168.1.20", [usb("COM5")]), { status: "ok" });
        assert.deepEqual(checkUploadPort("COM5", undefined), { status: "ok" });
        assert.equal(checkUploadPort("", undefined).status, "missing");
    });
});

suite("Arduino: upload port prompt", () => {
    test("empty port: modal asks to select a port, closing it launches nothing", async () => {
        const ui = new FakeUi("", [bare("COM1")], [undefined]);
        assert.equal(await ensureUploadPort(ui), undefined);
        assert.equal(ui.asked.length, 1);
        assert.equal(ui.asked[0].message, "No serial port selected for upload.");
        assert.deepEqual(ui.asked[0].buttons, ["Select a port"]);
        assert.equal(ui.picked, 0);
    });

    test("empty port: the chosen port resumes the upload", async () => {
        const ui = new FakeUi("", [usb("COM5"), usb("COM6")], ["Select a port"], "COM6");
        assert.equal(await ensureUploadPort(ui), "COM6");
        assert.equal(ui.picked, 1);
        assert.equal(ui.asked.length, 1);
    });

    test("empty port: abandoning the port picker launches nothing", async () => {
        const ui = new FakeUi("", [usb("COM5"), usb("COM6")], ["Select a port"], undefined);
        assert.equal(await ensureUploadPort(ui), undefined);
    });

    test("absent port: modal names the port and nothing is launched", async () => {
        const ui = new FakeUi("COM9", [usb("COM5"), usb("COM6")], [undefined]);
        assert.equal(await ensureUploadPort(ui), undefined);
        assert.equal(ui.asked[0].message, "Port COM9 is not connected.");
        assert.deepEqual(ui.asked[0].buttons, ["Select a port"]);
    });

    test("single USB port: offered directly, one click uploads to it", async () => {
        const ui = new FakeUi("COM9", [bare("COM1"), usb("COM5")], ["Upload to COM5"]);
        assert.equal(await ensureUploadPort(ui), "COM5");
        assert.deepEqual(ui.asked[0].buttons, ["Upload to COM5", "Select a port"]);
        assert.equal(ui.port, "COM5", "le port retenu doit être inscrit dans arduino.yaml");
        assert.equal(ui.picked, 0);
    });

    test("connected port: no modal at all", async () => {
        const ui = new FakeUi("COM5", [usb("COM5")], []);
        assert.equal(await ensureUploadPort(ui), "COM5");
        assert.equal(ui.asked.length, 0);
    });
});

suite("Arduino: board not responding detection", () => {
    test("recognises avrdude sync failures, old and new wording", () => {
        assert.ok(isBoardNotRespondingLine("avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00"));
        assert.ok(isBoardNotRespondingLine("avrdude: stk500_recv(): programmer is not responding"));
        assert.ok(isBoardNotRespondingLine("avrdude stk500_recv() error: programmer is not responding"));
    });

    test("ignores ordinary upload output", () => {
        assert.ok(!isBoardNotRespondingLine("avrdude: 924 bytes of flash written"));
        assert.ok(!isBoardNotRespondingLine("Sketch uses 924 bytes (2%) of program storage space."));
    });
});

suite("Arduino: upload process tree", () => {
    let workDir: string;
    let fakeCli: string;

    // Faux arduino-cli : lance un fils endormi (le rôle d'avrdude), annonce son pid,
    // puis dort lui aussi. Avec l'argument notinsync il imite avrdude sans réponse.
    // Sous Windows, node range ses fils dans un objet job qui les tue avec lui : le banc
    // passerait même en ne tuant que le parent. `detached` les en sort, comme le fait le vrai
    // arduino-cli (Go) : seul l'arrêt de l'arbre (taskkill /T) les atteint alors.
    const FAKE_CLI = [
        "const { spawn } = require('child_process');",
        "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'],",
        "    { stdio: 'ignore', detached: process.platform === 'win32', windowsHide: true });",
        "process.stdout.write('CHILD ' + child.pid + '\\n');",
        "if (process.argv[2] === 'notinsync') {",
        "    process.stderr.write('avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00\\n');",
        "}",
        "setTimeout(() => {}, 60000);",
    ].join("\n");

    // L'hôte de test est l'exécutable de VS Code : sans cette variable il ouvrirait une fenêtre.
    const nodeEnv = () => ({ ...process.env, ELECTRON_RUN_AS_NODE: "1" });

    const isAlive = (pid: number) => {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return error.code === "EPERM";
        }
    };

    const waitUntilDead = async (pid: number, timeoutMs: number) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (!isAlive(pid)) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return !isAlive(pid);
    };

    /** Lance le faux CLI ; `onLine` reçoit chaque morceau de sortie, stdout comme stderr. */
    const launch = (abort: util.SpawnAbort, mode: string, onLine?: (s: string) => void) => {
        let resolveChild: (pid: number) => void;
        const childPid = new Promise<number>((resolve) => resolveChild = resolve);
        const run = util.spawn(process.execPath, [fakeCli, mode], { env: nodeEnv() }, {
            stdout: (s) => {
                const match = /CHILD (\d+)/.exec(s);
                if (match) {
                    resolveChild(Number(match[1]));
                }
                if (onLine) {
                    onLine(s);
                }
            },
            stderr: (s) => {
                if (onLine) {
                    onLine(s);
                }
            },
        }, abort);
        return { run, childPid };
    };

    // Écrire un .js neuf peut attendre l'antivirus plusieurs secondes quand la suite complète tourne.
    suiteSetup(function() {
        this.timeout(20000);
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), "arduino-upload-"));
        fakeCli = path.join(workDir, "fake-arduino-cli.js");
        fs.writeFileSync(fakeCli, FAKE_CLI);
    });

    suiteTeardown(function() {
        this.timeout(20000);
        try {
            fs.rmSync(workDir, { recursive: true, force: true });
        } catch {
            // Nettoyage au mieux.
        }
    });

    test("cancelling kills arduino-cli and its child", async function() {
        this.timeout(20000);
        const abort = new util.SpawnAbort();
        const { run, childPid } = launch(abort, "sleep");
        const pid = await childPid;
        assert.ok(isAlive(pid), "le fils doit tourner avant l'annulation");

        abort.abort(UploadAbort.Cancelled);
        const reason: any = await run.then(() => undefined, (r) => r);

        assert.ok(reason, "un téléversement annulé ne doit jamais passer pour réussi");
        assert.equal(reason.aborted, UploadAbort.Cancelled);
        const dead = await waitUntilDead(pid, 5000);
        if (!dead) {
            process.kill(pid);
        }
        assert.ok(dead, "le fils (avrdude) doit mourir avec arduino-cli");
    });

    test("first 'not in sync' kills the tree without waiting for the other attempts", async function() {
        this.timeout(20000);
        const abort = new util.SpawnAbort();
        const started = Date.now();
        const { run, childPid } = launch(abort, "notinsync", (s) => {
            if (isBoardNotRespondingLine(s)) {
                abort.abort(UploadAbort.NotResponding);
            }
        });
        const pid = await childPid;
        const reason: any = await run.then(() => undefined, (r) => r);

        assert.equal(reason.aborted, UploadAbort.NotResponding);
        assert.ok(Date.now() - started < 15000, "l'arrêt doit suivre le premier échec, pas le délai du faux CLI");
        const dead = await waitUntilDead(pid, 5000);
        if (!dead) {
            process.kill(pid);
        }
        assert.ok(dead, "le fils (avrdude) doit mourir avec arduino-cli");
    });

    test("an uninterrupted run still resolves normally", async function() {
        this.timeout(20000);
        const quickCli = path.join(workDir, "quick-cli.js");
        fs.writeFileSync(quickCli, "process.stdout.write('done\\n');");
        const result: any = await util.spawn(process.execPath, [quickCli], { env: nodeEnv() }, {}, new util.SpawnAbort());
        assert.equal(result.code, 0);
    });
});
