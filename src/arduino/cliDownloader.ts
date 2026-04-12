// Copyright (c) electropol-fr. All rights reserved.
// Licensed under the MIT license.
//
// Arduino CLI is distributed under the GNU General Public License v3.0.
// See https://github.com/arduino/arduino-cli for source code and license.

import * as child_process from "child_process";
import * as extract from "extract-zip";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { arduinoChannel } from "../common/outputChannel";

const GITHUB_API_LATEST = "https://api.github.com/repos/arduino/arduino-cli/releases/latest";

interface IPlatformInfo {
    archiveName: string;
    executableName: string;
}

function getPlatformInfo(version: string): IPlatformInfo | null {
    const platform = os.platform();
    const arch = os.arch();

    if (platform === "win32") {
        return {
            archiveName: `arduino-cli_${version}_Windows_64bit.zip`,
            executableName: "arduino-cli.exe",
        };
    } else if (platform === "darwin") {
        const suffix = arch === "arm64" ? "macOS_ARM64" : "macOS_64bit";
        return {
            archiveName: `arduino-cli_${version}_${suffix}.tar.gz`,
            executableName: "arduino-cli",
        };
    } else if (platform === "linux") {
        let suffix = "Linux_64bit";
        if (arch === "arm64") {
            suffix = "Linux_ARM64";
        } else if (arch === "arm") {
            suffix = "Linux_ARMv7";
        }
        return {
            archiveName: `arduino-cli_${version}_${suffix}.tar.gz`,
            executableName: "arduino-cli",
        };
    }
    return null;
}

function httpsGet(url: string, headers?: Record<string, string>): Promise<{ statusCode: number; headers: any; body: Buffer }> {
    return new Promise((resolve, reject) => {
        const reqHeaders = {
            "User-Agent": "vscode-arduino",
            ...headers,
        };
        const req = https.get(url, { headers: reqHeaders }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpsGet(res.headers.location, headers).then(resolve, reject);
            }
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks),
            }));
        });
        req.on("error", reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error("Request timed out"));
        });
    });
}

function downloadFile(url: string, destPath: string, progress: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
    return new Promise((resolve, reject) => {
        const reqHeaders = { "User-Agent": "vscode-arduino" };
        const request = (currentUrl: string) => {
            https.get(currentUrl, { headers: reqHeaders }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return request(res.headers.location);
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Download failed with status ${res.statusCode}`));
                    return;
                }
                const totalSize = parseInt(res.headers["content-length"] || "0", 10);
                let downloaded = 0;
                const file = fs.createWriteStream(destPath);
                res.on("data", (chunk: Buffer) => {
                    downloaded += chunk.length;
                    if (totalSize > 0) {
                        const pct = Math.round((downloaded / totalSize) * 100);
                        progress.report({ message: `${pct}%` });
                    }
                });
                res.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
                file.on("error", (err) => {
                    fs.unlinkSync(destPath);
                    reject(err);
                });
            }).on("error", reject);
        };
        request(url);
    });
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        child_process.exec(`tar -xzf "${archivePath}" -C "${destDir}"`, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

export async function getLatestCliVersion(): Promise<string> {
    const resp = await httpsGet(GITHUB_API_LATEST);
    if (resp.statusCode !== 200) {
        throw new Error(`GitHub API returned status ${resp.statusCode}`);
    }
    const release = JSON.parse(resp.body.toString("utf8"));
    // tag_name is like "v1.4.1", strip the "v"
    return release.tag_name.replace(/^v/, "");
}

/**
 * Returns the path to the downloaded Arduino CLI if it exists, or null.
 */
export function getDownloadedCliPath(extensionPath: string): string | null {
    const cliDir = path.join(extensionPath, "arduino-cli");
    const platform = os.platform();
    const execName = platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
    const execPath = path.join(cliDir, execName);
    if (fs.existsSync(execPath)) {
        return cliDir;
    }
    return null;
}

/**
 * Returns the full path to the downloaded CLI executable if it exists, or null.
 */
export function getDownloadedCliExecutable(extensionPath: string): string | null {
    const cliDir = getDownloadedCliPath(extensionPath);
    if (!cliDir) {
        return null;
    }
    const platform = os.platform();
    const execName = platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
    return path.join(cliDir, execName);
}

/**
 * Downloads and installs the Arduino CLI to the extension's storage directory.
 * Returns the directory containing the CLI executable.
 */
export async function downloadArduinoCli(extensionPath: string): Promise<string> {
    const cliDir = path.join(extensionPath, "arduino-cli");

    const version = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Arduino CLI",
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: "Checking latest version..." });
        return await getLatestCliVersion();
    });

    const platformInfo = getPlatformInfo(version);
    if (!platformInfo) {
        throw new Error(`Unsupported platform: ${os.platform()} ${os.arch()}`);
    }

    const downloadUrl = `https://github.com/arduino/arduino-cli/releases/download/v${version}/${platformInfo.archiveName}`;

    arduinoChannel.info(`Downloading Arduino CLI v${version} from ${downloadUrl}...`);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading Arduino CLI v${version}`,
        cancellable: false,
    }, async (progress) => {
        // Ensure target directory exists
        if (!fs.existsSync(cliDir)) {
            fs.mkdirSync(cliDir, { recursive: true });
        }

        const archivePath = path.join(cliDir, platformInfo.archiveName);

        // Download archive
        progress.report({ message: "0%" });
        await downloadFile(downloadUrl, archivePath, progress);

        // Extract
        progress.report({ message: "Extracting..." });
        if (platformInfo.archiveName.endsWith(".zip")) {
            await extract(archivePath, { dir: cliDir });
        } else {
            await extractTarGz(archivePath, cliDir);
        }

        // Make executable on Unix
        if (os.platform() !== "win32") {
            const execPath = path.join(cliDir, platformInfo.executableName);
            fs.chmodSync(execPath, 0o755);
        }

        // Clean up archive
        try {
            fs.unlinkSync(archivePath);
        } catch {
            // Ignore cleanup errors
        }

        progress.report({ message: "Done!" });
    });

    // Write version file for future reference
    fs.writeFileSync(path.join(cliDir, "VERSION"), version, "utf8");

    arduinoChannel.info(`Arduino CLI v${version} installed to ${cliDir}`);
    vscode.window.showInformationMessage(`Arduino CLI v${version} installed successfully.`);

    return cliDir;
}

/**
 * Prompts the user to download the Arduino CLI if it's not found.
 * Returns the CLI directory, or null if the user declined.
 */
export async function promptDownloadCli(extensionPath: string): Promise<string | null> {
    const choice = await vscode.window.showInformationMessage(
        "Arduino CLI not found. Would you like to download it automatically?",
        "Download",
        "Configure manually",
    );

    if (choice === "Download") {
        try {
            return await downloadArduinoCli(extensionPath);
        } catch (error) {
            arduinoChannel.error(`Failed to download Arduino CLI: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to download Arduino CLI: ${error.message}`);
            return null;
        }
    } else if (choice === "Configure manually") {
        vscode.commands.executeCommand("workbench.action.openSettings", "arduino.path");
    }
    return null;
}

/**
 * Checks if a newer version of the CLI is available and offers to update.
 */
export async function checkForCliUpdate(extensionPath: string): Promise<void> {
    const cliDir = path.join(extensionPath, "arduino-cli");
    const versionFile = path.join(cliDir, "VERSION");
    if (!fs.existsSync(versionFile)) {
        return;
    }
    try {
        const currentVersion = fs.readFileSync(versionFile, "utf8").trim();
        const latestVersion = await getLatestCliVersion();
        if (currentVersion !== latestVersion) {
            const choice = await vscode.window.showInformationMessage(
                `Arduino CLI update available: v${currentVersion} → v${latestVersion}`,
                "Update",
                "Later",
            );
            if (choice === "Update") {
                // Remove old installation
                const files = fs.readdirSync(cliDir);
                for (const f of files) {
                    fs.unlinkSync(path.join(cliDir, f));
                }
                await downloadArduinoCli(extensionPath);
            }
        }
    } catch {
        // Silently fail version check
    }
}
