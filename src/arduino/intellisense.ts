// Copyright (c) Elektronik Workshop. All rights reserved.
// Licensed under the MIT license.

import * as ccp from "cocopa";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import * as constants from "../common/constants";
import { arduinoChannel } from "../common/outputChannel";
import { ArduinoWorkspace } from "../common/workspace";
import { DeviceContext } from "../deviceContext";
import { VscodeSettings } from "./vscodeSettings";

export interface ICoCoPaContext {
    callback: (s: string) => void;
    conclude: () => Promise<void>;
}

/**
 * Returns true if the combination of global enable/disable and project
 * specific override enable the auto-generation of the IntelliSense
 * configuration.
 */
export function isCompilerParserEnabled(dc?: DeviceContext) {
    if (!dc) {
        dc = DeviceContext.getInstance();
    }
    const globalDisable = VscodeSettings.getInstance().disableIntelliSenseAutoGen;
    const projectSetting = dc.intelliSenseGen;
    return projectSetting !== "disable" && !globalDisable ||
           projectSetting === "enable";
}

/**
 * Creates a context which is used for compiler command parsing
 * during building (verify, upload, ...).
 *
 * This context makes sure that it can be used in those sections
 * without having to check whether this feature is en- or disabled
 * and keeps the calling context more readable.
 *
 * @param dc The device context of the caller.
 *
 * Possible enhancements:
 *
 * * Order of includes: Perhaps insert the internal includes at the front
 *     as at least for the forcedIncludes IntelliSense seems to take the
 *     order into account.
 */
export function makeCompilerParserContext(dc: DeviceContext, buildMode?: string): ICoCoPaContext {

    if (!isCompilerParserEnabled(dc)) {
        return {
            callback: undefined,
            conclude: async () => {
                arduinoChannel.info(vscode.l10n.t("IntelliSense auto-configuration disabled."));
            },
        };
    }

    const engines = makeCompilerParserEngines(dc);
    const runner = new ccp.Runner(engines);

    // Set up the callback to be called after parsing
    const _conclude = async () => {
        if (!runner.result) {
            // Determine whether this build mode is upload-only (no compilation)
            const isUploadOnly = buildMode === "Uploading using Arduino CLI"
                              || buildMode === "Uploading (programmer) using Arduino CLI";
            // Check whether an existing IntelliSense config is already present
            const cppConfigPath = path.join(ArduinoWorkspace.rootPath, constants.CPP_CONFIG_FILE);
            const hasExistingConfig = fs.existsSync(cppConfigPath);

            if (isUploadOnly) {
                // Upload-only modes never compile — no IntelliSense data is expected
                arduinoChannel.info(vscode.l10n.t("IntelliSense configuration skipped (upload-only, no compilation)."));
                return;
            }
            if (hasExistingConfig) {
                // Compilation was requested but the build cache was reused,
                // so no compiler commands were emitted. The existing config
                // is still valid — this is not an error.
                arduinoChannel.info(vscode.l10n.t("No new IntelliSense data captured (build cache reused). Existing configuration kept."));
                return;
            }
            // Genuine failure: compilation should have produced output but didn't
            arduinoChannel.warning(vscode.l10n.t("Failed to generate IntelliSense configuration."));
            return;
        }

        // Normalize compiler and include paths (resolve ".." and ".")
        runner.result.normalize();
        // Remove invalid paths
        await runner.result.cleanup();

        // PR #84: Normalize "--param name value" into "--param=name=value" for IntelliSense/clang compatibility
        // GCC accepts both forms but clang (used by IntelliSense) only accepts --param=name=value
        if (runner.result.options) {
            const normalizedOptions: string[] = [];
            for (let i = 0; i < runner.result.options.length; i++) {
                const opt = runner.result.options[i];
                if (opt === "--param" && i + 1 < runner.result.options.length) {
                    const nextOpt = runner.result.options[i + 1];
                    // If next arg looks like "name=value" or just "name value" pattern
                    normalizedOptions.push(`--param=${nextOpt}`);
                    i++; // skip next argument
                } else {
                    normalizedOptions.push(opt);
                }
            }
            runner.result.options = normalizedOptions;
        }

        // Search for Arduino.h in the include paths - we need it for a
        // forced include - users expect Arduino symbols to be available
        // in main sketch without having to include the header explicitly
        const ardHeader = await runner.result.findFile("Arduino.h");
        const forcedIncludes = ardHeader.length > 0
            ? ardHeader
            : undefined;
        if (!forcedIncludes) {
            arduinoChannel.warning(vscode.l10n.t("Unable to locate \"Arduino.h\" within IntelliSense include paths."));
        }

        // The C++ standard is set to the following default value if no compiler flag has been found.
        const content = new ccp.CCppPropertiesContentResult(runner.result,
                                                            constants.C_CPP_PROPERTIES_CONFIG_NAME,
                                                            ccp.CCppPropertiesISMode.Gcc_X64,
                                                            ccp.CCppPropertiesCStandard.C11,
                                                            ccp.CCppPropertiesCppStandard.Cpp11,
                                                            forcedIncludes);

        // The following 4 lines are added to prevent null.d from being created in the workspace
        // directory on MacOS and Linux. This is may be a bug in intelliSense
        const mmdIndex = runner.result.options.findIndex((element) => element === "-MMD");
        if (mmdIndex) {
            runner.result.options.splice(mmdIndex);
        }

        // Add USB Connected macro to defines
        runner.result.defines.push("USBCON");

        // Issue #70: Add ARDUINO define for compatibility - many libraries check for this
        // The value 10800+ corresponds to Arduino IDE 1.8+
        if (!runner.result.defines.find((d) => d.startsWith("ARDUINO="))) {
            runner.result.defines.push("ARDUINO=10813");
        }

        try {

            const cmd = os.platform() === "darwin" ? "Cmd" : "Ctrl";
            const help = vscode.l10n.t("To manually rebuild your IntelliSense configuration run \"{0}+Alt+I\"", cmd);
            const pPath = path.join(ArduinoWorkspace.rootPath, constants.CPP_CONFIG_FILE);
            const prop = new ccp.CCppProperties();
            prop.read(pPath);
            prop.merge(content, ccp.CCppPropertiesMergeMode.ReplaceSameNames);
            if (prop.write(pPath)) {
                arduinoChannel.info(vscode.l10n.t("IntelliSense configuration updated. {0}", help));
            } else {
                arduinoChannel.info(vscode.l10n.t("IntelliSense configuration already up to date. {0}", help));
            }
        } catch (e) {
            arduinoChannel.error(vscode.l10n.t("Failed to read or write IntelliSense configuration: {0}", JSON.stringify(e)));
        }
    };
    return {
        callback: runner.callback(),
        conclude: _conclude,
    }
}

/**
 * Assembles compiler parser engines which then will be used to find the main
 * sketch's compile command and parse the infomation from it required for
 * assembling an IntelliSense configuration from it.
 *
 * It could return multiple engines for different compilers or - if necessary -
 * return specialized engines based on the current board architecture.
 *
 * @param dc Current device context used to generate the engines.
 */
function makeCompilerParserEngines(dc: DeviceContext) {
    const sketch = path.basename(dc.sketch);
    const trigger = ccp.getTriggerForArduinoGcc(sketch);
    const gccParserEngine = new ccp.ParserGcc(trigger);
    return [gccParserEngine];
}

// Not sure why eslint fails to detect usage of these enums, so disable checking.
/**
 * Possible states of AnalysisManager's state machine.
 */
enum AnalysisState {
    /**
     * No analysis request pending.
     */
    Idle = "idle",
    /**
     * Analysis request pending. Waiting for the time out to expire or for
     * another build to complete.
     */
    Waiting = "waiting",
    /**
     * Analysis in progress.
     */
    Analyzing = "analyzing",
    /**
     * Analysis in progress with yet another analysis request pending.
     * As soon as the current analysis completes the manager will directly
     * enter the Waiting state.
     */
    AnalyzingWaiting = "analyzing and waiting",
}

/**
 * Events (edges) which cause state changes within AnalysisManager.
 */
enum AnalysisEvent {
    /**
     * The only external event. Requests an analysis to be run.
     */
    AnalysisRequest,
    /**
     * The internal wait timeout expired.
     */
    WaitTimeout,
    /**
     * The current analysis build finished.
     */
    AnalysisBuildDone,
}

/**
 * This class manages analysis builds for the automatic IntelliSense
 * configuration synthesis. Its primary purposes are:
 *
 *  * delaying analysis requests caused by DeviceContext setting change
 *      events such that multiple subsequent requests don't cause
 *      multiple analysis builds
 *  * make sure that an analysis request is postponed when another build
 *      is currently in progress
 */
export class AnalysisManager {

    /** The manager's state. */
    private _state: AnalysisState = AnalysisState.Idle;
    /** A callback used by the manager to query if the build backend is busy. */
    private _isBuilding: () => boolean;
    /** A callback used by the manager to initiate an analysis build. */
    private _doBuild: () => Promise<void>;
    /** Timeout for the timeouts/delays in milliseconds. */
    private _waitPeriodMs: number;
    /** The internal timer used to implement the above timeouts and delays. */
    private _timer: NodeJS.Timer;
    /** Issue #76: Track consecutive analysis to prevent infinite loop */
    private _consecutiveAnalysisCount: number = 0;
    private _maxConsecutiveAnalysis: number = 3;
    private _lastAnalysisTime: number = 0;

    /**
     * Constructor.
     * @param isBuilding Provide a callback which returns true if another build
     * is currently in progress.
     * @param doBuild Provide a callback which runs the analysis build.
     * @param waitPeriodMs The delay the manger should wait for potential new
     * analysis request. This delay is used as polling interval as well when
     * checking for ongoing builds.
     */
    constructor(isBuilding: () => boolean,
                doBuild: () => Promise<void>,
                waitPeriodMs: number = 1000) {
        this._isBuilding = isBuilding;
        this._doBuild = doBuild;
        this._waitPeriodMs = waitPeriodMs;
    }

    /**
     * File an analysis request.
     * The analysis will be delayed until no further requests are filed
     * within a wait period or until any build in progress has terminated.
     * Issue #76: Rate-limit consecutive analysis to prevent CPU overload.
     */
    public async requestAnalysis() {
        const now = Date.now();
        // Reset consecutive count if enough time has passed
        if (now - this._lastAnalysisTime > this._waitPeriodMs * 10) {
            this._consecutiveAnalysisCount = 0;
        }
        if (this._consecutiveAnalysisCount >= this._maxConsecutiveAnalysis) {
            arduinoChannel.warning(vscode.l10n.t("Analysis request throttled to prevent high CPU usage. Try rebuilding IntelliSense manually."));
            return;
        }
        if (this.isConfigUpToDate()) {
            return;
        }
        await this.update(AnalysisEvent.AnalysisRequest);
    }

    private isConfigUpToDate(): boolean {
        if (!ArduinoWorkspace.rootPath) {
            return false;
        }
        const configPath = path.join(ArduinoWorkspace.rootPath, constants.CPP_CONFIG_FILE);
        if (!fs.existsSync(configPath)) {
            return false;
        }
        const configMtime = fs.statSync(configPath).mtimeMs;
        const arduinoJsonPath = path.join(ArduinoWorkspace.rootPath, constants.ARDUINO_CONFIG_FILE);
        const dc = DeviceContext.getInstance();
        const sketchPath = dc.sketch ? path.join(ArduinoWorkspace.rootPath, dc.sketch) : null;
        const arduinoMtime = fs.existsSync(arduinoJsonPath) ? fs.statSync(arduinoJsonPath).mtimeMs : 0;
        const sketchMtime = sketchPath && fs.existsSync(sketchPath) ? fs.statSync(sketchPath).mtimeMs : 0;
        return configMtime > arduinoMtime && configMtime > sketchMtime;
    }

    /**
     * Update the manager's state machine.
     * @param event The event which will cause the state transition.
     *
     * Implementation note: asynchronous edge actions must be called after
     * setting the new state since they don't return immediately.
     */
    private async update(event: AnalysisEvent) {

        switch (this._state) {

            case AnalysisState.Idle:
                if (event === AnalysisEvent.AnalysisRequest) {
                    this._state = AnalysisState.Waiting;
                    this.startWaitTimeout();
                }
                break;

            case AnalysisState.Waiting:
                if (event === AnalysisEvent.AnalysisRequest) {
                    // every new request restarts timer
                    this.startWaitTimeout();
                } else if (event === AnalysisEvent.WaitTimeout) {
                    if (this._isBuilding()) {
                        // another build in progress, continue waiting
                        this.startWaitTimeout();
                    } else {
                        // no other build in progress -> launch analysis
                        this._state = AnalysisState.Analyzing;
                        await this.startAnalysis();
                    }
                }
                break;

            case AnalysisState.Analyzing:
                if (event === AnalysisEvent.AnalysisBuildDone) {
                    this._state = AnalysisState.Idle;
                } else if (event === AnalysisEvent.AnalysisRequest) {
                    this._state = AnalysisState.AnalyzingWaiting;
                }
                break;

            case AnalysisState.AnalyzingWaiting:
                if (event === AnalysisEvent.AnalysisBuildDone) {
                    // emulate the transition from idle to waiting
                    // (we don't care if this adds an additional
                    // timeout - event driven analysis is not time-
                    // critical)
                    this._state = AnalysisState.Idle;
                    await this.update(AnalysisEvent.AnalysisRequest);
                }
                break;
        }
    }

    /**
     * Starts the wait timeout timer.
     * If it's already running, the current timer is stopped and restarted.
     * The timeout callback will then update the state machine.
     */
    private startWaitTimeout() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
        this._timer = setTimeout(() => {
            // reset timer variable first - calling update can cause
            // the timer to be restarted.
            this._timer = undefined;
            this.update(AnalysisEvent.WaitTimeout);
        }, this._waitPeriodMs);
    }

    /**
     * Starts the analysis build.
     * When done, the callback will update the state machine.
     */
    private async startAnalysis() {
        this._consecutiveAnalysisCount++;
        this._lastAnalysisTime = Date.now();
        await this._doBuild()
        .then(() => {
            this.update(AnalysisEvent.AnalysisBuildDone);
        })
        .catch((reason) => {
            this.update(AnalysisEvent.AnalysisBuildDone);
        });
    }
}
