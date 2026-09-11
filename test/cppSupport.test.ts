import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { addSketchEntries, ICompileCommand, targetForCompiler } from "../src/arduino/cppSupport";

suite("Arduino: clangd target detection", () => {
    test("maps each Arduino toolchain to its clang target", () => {
        assert.equal(targetForCompiler("C:/Arduino15/tools/avr-gcc/7.3.0/bin/avr-g++"), "avr");
        assert.equal(targetForCompiler("/home/user/.arduino15/.../bin/avr-gcc"), "avr");
        assert.equal(targetForCompiler("C:/tools/gcc/bin/arm-none-eabi-g++.exe"), "arm-none-eabi");
        assert.equal(targetForCompiler("/opt/tools/bin/riscv32-esp-elf-gcc"), "riscv32");
    });

    test("leaves the target unset for toolchains clang cannot handle", () => {
        // Xtensa (ESP8266, ESP32 d'origine) n'existe pas en amont de LLVM : mieux vaut
        // une analyse native imparfaite qu'une cible refusée par clang.
        assert.equal(targetForCompiler("/opt/xtensa-lx106-elf/bin/xtensa-lx106-elf-g++"), undefined);
        assert.equal(targetForCompiler("/usr/bin/some-unknown-compiler"), undefined);
    });
});

suite("Arduino: clangd compilation database", () => {
    let sketchDir: string;

    setup(() => {
        sketchDir = fs.mkdtempSync(path.join(os.tmpdir(), "arduino-clangd-"));
    });

    teardown(() => {
        try {
            fs.rmSync(sketchDir, { recursive: true, force: true });
        } catch {
            // Nettoyage au mieux : un verrou de l'OS ne doit pas faire échouer le test.
        }
    });

    /** Entrée telle que produite par arduino-cli : elle vise le .ino.cpp généré. */
    const makeEntry = (buildDir: string): ICompileCommand => {
        const generated = path.join(buildDir, "sketch", "Blink.ino.cpp");
        return {
            directory: buildDir,
            arguments: ["/tools/bin/avr-g++", "-c", "-mmcu=atmega328p", generated, "-o", generated + ".o"],
            file: generated,
        };
    };

    test("adds an entry for each .ino of the sketch", () => {
        fs.writeFileSync(path.join(sketchDir, "Blink.ino"), "void setup() {}\n");
        fs.writeFileSync(path.join(sketchDir, "helper.ino"), "void helper() {}\n");
        // Un fichier non-.ino ne doit pas être ajouté : il a déjà sa propre entrée.
        fs.writeFileSync(path.join(sketchDir, "notes.txt"), "");

        const entries = addSketchEntries([makeEntry(path.join(sketchDir, ".build"))], sketchDir, sketchDir);

        const inoFiles = entries.filter((e) => /\.ino$/i.test(e.file)).map((e) => path.basename(e.file));
        assert.deepEqual(inoFiles.sort(), ["Blink.ino", "helper.ino"]);
    });

    test("points the added entry at the real .ino, not the generated file", () => {
        const inoPath = path.join(sketchDir, "Blink.ino");
        fs.writeFileSync(inoPath, "void setup() {}\n");

        const entries = addSketchEntries([makeEntry(path.join(sketchDir, ".build"))], sketchDir, sketchDir);
        const added = entries.find((e) => /\.ino$/i.test(e.file));

        assert.ok(added, "une entrée pour le .ino doit exister");
        assert.ok(added.arguments.includes(inoPath), "le .ino doit figurer dans les arguments");
        assert.ok(!added.arguments.some((a) => a.endsWith(".ino.cpp")),
            "le fichier généré ne doit plus figurer comme source");
    });

    test("forces C++ before the file name", () => {
        const inoPath = path.join(sketchDir, "Blink.ino");
        fs.writeFileSync(inoPath, "void setup() {}\n");

        const entries = addSketchEntries([makeEntry(path.join(sketchDir, ".build"))], sketchDir, sketchDir);
        const added = entries.find((e) => /\.ino$/i.test(e.file));

        // Sans « -x c++ » clang prend le .ino pour un fichier objet et clangd abandonne
        // sur « expected exactly one compiler job ». L'option ne vaut que pour ce qui
        // la suit : elle doit donc précéder le nom du fichier.
        const xIndex = added.arguments.indexOf("-x");
        assert.notEqual(xIndex, -1, "« -x » doit être présent");
        assert.equal(added.arguments[xIndex + 1], "c++");
        assert.ok(xIndex < added.arguments.indexOf(inoPath), "« -x c++ » doit précéder le fichier");
    });

    test("keeps the original entries untouched", () => {
        fs.writeFileSync(path.join(sketchDir, "Blink.ino"), "void setup() {}\n");
        const original = makeEntry(path.join(sketchDir, ".build"));

        const entries = addSketchEntries([original], sketchDir, sketchDir);

        assert.equal(entries.length, 2, "l'entrée d'origine est conservée, une seule est ajoutée");
        assert.deepEqual(entries[0], original);
    });

    test("does not duplicate an entry the database already provides", () => {
        const inoPath = path.join(sketchDir, "Blink.ino");
        fs.writeFileSync(inoPath, "void setup() {}\n");

        const existing: ICompileCommand = {
            directory: sketchDir,
            arguments: ["/tools/bin/avr-g++", "-c", "-x", "c++", inoPath],
            file: inoPath,
        };

        const entries = addSketchEntries([makeEntry(path.join(sketchDir, ".build")), existing], sketchDir, sketchDir);
        const forIno = entries.filter((e) => path.resolve(e.file).toLowerCase() === path.resolve(inoPath).toLowerCase());

        assert.equal(forIno.length, 1, "un .ino déjà décrit ne doit pas recevoir de seconde entrée");
    });

    test("returns the entries unchanged when the sketch has no .ino", () => {
        const original = makeEntry(path.join(sketchDir, ".build"));
        const entries = addSketchEntries([original], sketchDir, sketchDir);
        assert.deepEqual(entries, [original]);
    });
});
