# Arduino for Visual Studio Code

> **This is a community fork** of the [original Microsoft vscode-arduino extension](https://github.com/Microsoft/vscode-arduino), which is no longer actively maintained. This fork is also based on work from the [vscode-arduino community fork](https://github.com/vscode-arduino/vscode-arduino).
>
> Original extension © Microsoft Corporation — licensed under the [MIT License](LICENSE.txt).
> Modifications by [Frank SAURET](https://github.com/FrankSAURET).

---

Welcome to the Visual Studio Code extension for **Arduino**! This extension makes it easy to develop, build, deploy and debug your Arduino sketches in Visual Studio Code, with a rich set of functionalities:

* IntelliSense and syntax highlighting for Arduino sketches
* Verify and upload your sketches in Visual Studio Code
* Built-in board and library manager
* Built-in example list
* Built-in serial monitor
* Snippets for sketches
* Automatic Arduino project scaffolding
* Command Palette (<kbd>F1</kbd>) integration of frequently used commands
* Integrated Arduino Debugging
* Multi-root workspace support
* Custom library and package paths

## What's new in this fork

Compared to the original Microsoft extension (v0.4.12), this fork includes:

- **Telemetry removed**: All Application Insights telemetry and NSAT survey tracking have been completely removed.
- **Security fix (CVE-2024-43488)**: The local webserver used for Board/Library Manager webviews is now protected by a cryptographic authentication token.
- **Arduino CLI as default**: `arduino.useArduinoCli` now defaults to `true`. The extension is optimized for modern Arduino CLI workflows.
- **IntelliSense improvements**:
  - `--param` normalization for STM32 and other GCC-based toolchains (clang compatibility)
  - `ARDUINO` define automatically added for library compatibility
  - `boards.local.txt` support for custom board definitions
- **Serial Monitor improvements**:
  - Input field is cleared after sending a message
  - Serial port close timeout prevents blocking during uploads
  - Improved ESP32 DTR/RTS handling to avoid unwanted reboots
  - Wait-for-port support for USB CDC boards (e.g. Arduino Uno R4 WiFi)
- **Multi-root workspace support**: The workspace root is resolved based on the active editor file.
- **Custom paths**: New `arduino.customLibraryPath` and `arduino.arduinoCliConfigFile` settings.
- **Build path fix**: Output build path is properly normalized and validated.
- **CPU load fix**: IntelliSense analysis is rate-limited to prevent high CPU usage from repeated triggers.

## Prerequisites

### Arduino CLI (recommended)
The Arduino CLI is the recommended backend. Download it from the [official releases page](https://github.com/arduino/arduino-cli/releases).
- Make sure `arduino-cli` is on your system PATH, or set `arduino.path` to point to its directory.
- You can use a local `arduino-cli.yaml` configuration file via the `arduino.arduinoCliConfigFile` setting.

### Arduino IDE (legacy)
The Arduino IDE can be installed from the [Arduino download page](https://www.arduino.cc/en/main/software#download).
- Set `arduino.useArduinoCli` to `false` in your VS Code settings.
- Supported versions: `1.6.x` and later.
- The Windows Store version is not supported.

## Installation
Open VS Code and press <kbd>F1</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> *or* <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to open command palette, select **Install Extension** and type `vscode-arduino`.

Or launch VS Code Quick Open (<kbd>Ctrl</kbd> + <kbd>P</kbd> *or* <kbd>Cmd</kbd> + <kbd>P</kbd>), paste the following command, and press enter.
```bash
ext install electropol-fr.vscode-arduino
```

## Commands
This extension provides several commands in the Command Palette (<kbd>F1</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> *or* <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>) for working with `*.ino` files:

- **Arduino: Board Manager**: Manage packages for boards. You can add 3rd party Arduino board by configuring `Additional Board Manager URLs` in the board manager.
- **Arduino: Change Baud Rate**: Change the baud rate of the selected serial port.
- **Arduino: Change Board Type**: Change board type or platform.
- **Arduino: Change Timestamp Format**: Change format of timestamp printed before each line of Serial Monitor output.
- **Arduino: Close Serial Monitor**: Stop the serial monitor and release the serial port.
- **Arduino: Examples**: Show list of examples.
- **Arduino: Initialize**: Scaffold a VS Code project with an Arduino sketch.
- **Arduino: Library Manager**: Explore and manage libraries.
- **Arduino: Open Serial Monitor**: Open the serial monitor in the integrated output window.
- **Arduino: Select Serial Port**: Change the current serial port.
- **Arduino: Send Text to Serial Port**: Send a line of text via the current serial port.
- **Arduino: Upload**: Build sketch and upload to Arduino board.
- **Arduino: CLI Upload**: Upload complied code without building sketch (CLI only).
- **Arduino: Upload Using Programmer**: Upload using an external programmer.
- **Arduino: CLI Upload Using Programmer**: Upload using an external programmer without building sketch (CLI only).
- **Arduino: Verify**: Build sketch.
- **Arduino: Rebuild IntelliSense Configuration**: Forced/manual rebuild of the IntelliSense configuration. The extension analyzes Arduino's build output and sets the IntelliSense include paths, defines, compiler arguments accordingly.

## Keybindings
- **Arduino: Upload** <kbd>Alt</kbd> + <kbd>Cmd</kbd> + <kbd>U</kbd> *or* <kbd>Alt</kbd> + <kbd>Ctrl</kbd> + <kbd>U</kbd>
- **Arduino: Verify** <kbd>Alt</kbd> + <kbd>Cmd</kbd> + <kbd>R</kbd> *or* <kbd>Alt</kbd> + <kbd>Ctrl</kbd> + <kbd>R</kbd>
- **Arduino: Rebuild IntelliSense Configuration** <kbd>Alt</kbd> + <kbd>Cmd</kbd> + <kbd>I</kbd> *or* <kbd>Alt</kbd> + <kbd>Ctrl</kbd> + <kbd>I</kbd>

## Options
| Option | Description |
| --- | --- |
| `arduino.path`  | Path to Arduino, you can use a custom version of Arduino by modifying this setting to include the full path. Example: `C:\\Program Files\\Arduino` for Windows, `/Applications` for Mac, `/home/<username>/Downloads/arduino-1.8.1` for Linux. (Requires a restart after change). The default value is automatically detected from your Arduino IDE installation path. |
| `arduino.commandPath` | Path to an executable (or script) relative to `arduino.path`. The default value is `arduino_debug.exe` for Windows, `Contents/MacOS/Arduino` for Mac and `arduino` for Linux, You also can use a custom launch script to run Arduino by modifying this setting. (Requires a restart after change) Example: `run-arduino.bat` for Windows, `Contents/MacOS/run-arduino.sh` for Mac and `bin/run-arduino.sh` for Linux. |
| `arduino.additionalUrls` | Additional Boards Manager URLs for 3rd party packages as a string array. The default value is empty. |
| `arduino.logLevel` | CLI output log level. Could be info or verbose. The default value is `"info"`. |
| `arduino.clearOutputOnBuild` | Clear the output logs before uploading or verifying. Default value is `false`. |
| `arduino.allowPDEFiletype` | Allow the VSCode Arduino extension to open .pde files from pre-1.0.0 versions of Arduino. Note that this will break Processing code. Default value is `false`. | 
| `arduino.enableUSBDetection` | Enable/disable USB detection from the VSCode Arduino extension. The default value is `true`. When your device is plugged in to your computer, it will pop up a message "`Detected board ****, Would you like to switch to this board type`". After clicking the `Yes` button, it will automatically detect which serial port (COM) is connected a USB device. If your device does not support this feature, please provide us with the PID/VID of your device; the code format is defined in `misc/usbmapping.json`.To learn more about how to list the vid/pid, use the following tools: https://github.com/EmergingTechnologyAdvisors/node-serialport `npm install -g serialport` `serialport-list -f jsonline`|
| `arduino.disableTestingOpen` | Enable/disable automatic sending of a test message to the serial port for checking the open status. The default value is `false` (a test message will be sent). |
| `arduino.skipHeaderProvider` | Enable/disable the extension providing completion items for headers. This functionality is included in newer versions of the C++ extension. The default value is `false`.|
| `arduino.defaultBaudRate` | Default baud rate for the serial port monitor. The default value is 115200. Supported values are 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400 and 250000 |
| `arduino.defaultTimestampFormat` | Format of timestamp printed before each line of Serial Monitor output. You can find list of all available placeholders [here](https://github.com/samsonjs/strftime#supported-specifiers). |
| `arduino.disableIntelliSenseAutoGen` | When `true` vscode-arduino will not auto-generate an IntelliSense configuration (i.e. `.vscode/c_cpp_properties.json`) by analyzing Arduino's compiler output. |
| `arduino.analyzeOnOpen` | When true, automatically run analysis when the project is opened. Only works when `arduino.analyzeOnSettingChange` is true. |
| `arduino.analyzeOnSettingChange` | When true, automatically run analysis when board, configuration, or sketch settings are changed. |
| `arduino.customLibraryPath` | Custom path for Arduino libraries. Used as an additional library search path when compiling. |
| `arduino.arduinoCliConfigFile` | Path to a local `arduino-cli.yaml` configuration file. When set, this file is used instead of the global configuration. |

The following Visual Studio Code settings are available for the Arduino extension. These can be set in global user preferences <kbd>Ctrl</kbd> + <kbd>,</kbd> *or* <kbd>Cmd</kbd> + <kbd>,</kbd> or workspace settings (`.vscode/settings.json`). The latter overrides the former.

```json
{
    "arduino.path": "C:/Program Files (x86)/Arduino",
    "arduino.commandPath": "arduino_debug.exe",
    "arduino.logLevel": "info",
    "arduino.allowPDEFiletype": false,
    "arduino.enableUSBDetection": true,
    "arduino.disableTestingOpen": false,
    "arduino.skipHeaderProvider": false,
    "arduino.additionalUrls": [
        "https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/master/package_azureboard_index.json",
        "http://arduino.esp8266.com/stable/package_esp8266com_index.json"
    ],
    "arduino.defaultBaudRate": 115200
}
```
*Note:* You only need to set `arduino.path` in Visual Studio Code settings, other options are not required.

The following settings are as per sketch settings of the Arduino extension. You can find them in
`.vscode/arduino.json` under the workspace.

```json
{
    "sketch": "example.ino",
    "port": "COM5",
    "board": "adafruit:samd:adafruit_feather_m0",
    "output": "../build",
    "debugger": "jlink",
    "prebuild": "./prebuild.sh",
    "postbuild": "./postbuild.sh",
    "intelliSenseGen": "global"
}
```
- `sketch` - The main sketch file name of Arduino.
- `port` - Name of the serial port connected to the device. Can be set by the `Arduino: Select Serial Port` command. For Mac users could be "/dev/cu.wchusbserial1420".
- `board` - Currently selected Arduino board alias. Can be set by the `Arduino: Change Board Type` command. Also, you can find the board list there.
- `output` - Arduino build output path. If not set, Arduino will create a new temporary output folder each time, which means it cannot reuse the intermediate result of the previous build leading to long verify/upload time, so it is recommended to set the field. Arduino requires that the output path should not be the workspace itself or in a subfolder of the workspace, otherwise, it may not work correctly. By default, this option is not set. It's worth noting that the contents of this file could be deleted during the build process, so pick (or create) a directory that will not store files you want to keep.
- `debugger` - The short name of the debugger that will be used when the board itself does not have a debugger and there is more than one debugger available. You can find the list of debuggers [here](https://github.com/Microsoft/vscode-arduino/blob/main/misc/debuggerUsbMapping.json). By default, this option is not set.
- `prebuild` - External command which will be invoked before any sketch build (verify, upload, ...). For details see the [Pre- and Post-Build Commands](#Pre--and-Post-Build-Commands) section.
- `postbuild` - External command to be run after the sketch has been built successfully. See the afore mentioned section for more details.
- `intelliSenseGen` - Override the global setting for auto-generation of the IntelliSense configuration (i.e. `.vscode/c_cpp_properties.json`). Three options are available:
  - `"global"`: Use the global settings (default)
  - `"disable"`: Disable the auto-generation even if globally enabled
  - `"enable"`: Enable the auto-generation even if globally disabled
- `buildPreferences` - Set Arduino preferences which then are used during any build (verify, upload, ...). This allows for extra defines, compiler options or includes. The preference key-value pairs must be set as follows:
```json
    "buildPreferences": [
        ["build.extra_flags", "-DMY_DEFINE=666 -DANOTHER_DEFINE=3.14 -Wall"],
        ["compiler.cpp.extra_flags", "-DYET_ANOTER=\"hello\""]
    ]
}
```

## Pre- and Post-Build Commands
On Windows the commands run within a `cmd`-, on Linux and OSX within a `bash`-instance. Therefore your command can be anything what you can run within those shells. Instead of running a command you can invoke a script. This makes writing more complex pre-/post-build mechanisms much easier and opens up the possibility to run python or other scripting languages.
The commands run within the workspace root directory and vscode-arduino sets the following environment variables:
**`VSCA_BUILD_MODE`** The current build mode, one of `Verifying`, `Uploading`, `Uploading (programmer)` or `Analyzing`. This allows you to run your script on certain build modes only.
**`VSCA_SKETCH`** The sketch file relative to your workspace root directory.
**`VSCA_BOARD`** Your board and configuration, e.g. `arduino:avr:nano:cpu=atmega328`.
**`VSCA_WORKSPACE_DIR`** The absolute path of your workspace root directory.
**`VSCA_LOG_LEVEL`** The current log level. This allows you to control the verbosity of your scripts.
**`VSCA_SERIAL`** The serial port used for uploading. Not set if you haven't set one in your `arduino.json`.
**`VSCA_BUILD_DIR`** The build directory. Not set if you haven't set one in your `arduino.json`.

For example under Windows the following `arduino.json` setup
```json
{
    "board": "arduino:avr:nano",
    "sketch": "test.ino",
    "configuration": "cpu=atmega328",
    "prebuild": "IF \"%VSCA_BUILD_MODE%\"==\"Verifying\" (echo VSCA_BUILD_MODE=%VSCA_BUILD_MODE% && echo VSCA_BOARD=%VSCA_BOARD%)"
}
```
will produce
```
[Starting] Verifying sketch 'test.ino'
Running pre-build command: "IF "%VSCA_BUILD_MODE%"=="Verifying" (echo VSCA_BUILD_MODE=%VSCA_BUILD_MODE% && echo VSCA_BOARD=%VSCA_BOARD%)"
VSCA_BUILD_MODE=Verifying
VSCA_BOARD=arduino:avr:nano:cpu=atmega328
Loading configuration...
<...>
```
when verifying.

## IntelliSense
vscode-arduino auto-configures IntelliSense by default. vscode-arduino analyzes Arduino's compiler output by running a separate build and generates the corresponding configuration file at `.vscode/c_cpp_properties.json`. vscode-arduino tries as hard as possible to keep things up to date, e.g. it runs the analysis when switching the board or the sketch.

It doesn't makes sense though to run the analysis repeatedly. Therefore if the workspace reports problems ("squiggles") - for instance after adding new includes from a new library - run the analysis manually:

Manual rebuild: **Arduino: Rebuild IntelliSense Configuration**,
Keybindings: <kbd>Alt</kbd> + <kbd>Cmd</kbd> + <kbd>I</kbd> *or* <kbd>Alt</kbd> + <kbd>Ctrl</kbd> + <kbd>I</kbd>

When the analysis is invoked manually it ignores any global and project specific disable.

### IntelliSense Configurations
vscode-arduino's analysis stores the result as a dedicated IntelliSense-configuration named `Arduino`. You have to select it from the far right of the status bar when you're in one of your source files as shown here:

![74001156-cfce8280-496a-11ea-9b9d-7d30c83765c1](https://user-images.githubusercontent.com/21954933/74351237-2696ea80-4db7-11ea-9f7a-1bfc652ad5f5.png)

This system allows you to setup and use own IntelliSense configurations in parallel to the automatically generated configurations provided through vscode-arduino. Just add your configuration to `c_cpp_properties.json` and name it differently from the default configuration (`Arduino`), e.g. `My awesome configuration` and select it from the status bar or via the command palette command **C/C++: Select a Configuration...**

## Debugging Arduino Code <sup>preview</sup>
Before you start to debug your Arduino code, please read [this document](https://code.visualstudio.com/docs/editor/debugging) to learn about the basic mechanisms of debugging in Visual Studio Code. Also see [debugging for C++ in VSCode](https://code.visualstudio.com/docs/languages/cpp#_debugging) for further reference.

Make sure that your Arduino board can work with [STLink](http://www.st.com/en/development-tools/st-link-v2.html), [Jlink](https://www.segger.com/jlink-debug-probes.html) or [EDBG](http://www.atmel.com/webdoc/protocoldocs/ch01s01.html). The debugging support is currently fully tested with the following boards:
- [MXChip IoT Developer Kit - AZ3166](https://microsoft.github.io/azure-iot-developer-kit/)
- [Arduino M0 PRO](https://www.arduino.cc/en/Main/ArduinoBoardM0PRO)
- [Adafruit WICED WiFi Feather](https://www.adafruit.com/product/3056)
- [Adafruit Feather M0](https://www.adafruit.com/product/3010)
- Arduino Zero Pro

Steps to start debugging:
1. Plug in your board to your development machine properly. For those boards that do not have an on-board debugging chip, you need to use a STLink or JLink connector.
2. Go to the **Debug View** (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> *or* <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>). and set breakpoints in your source files.
3. Press <kbd>F5</kbd> to select your debugging environment.
4. When your breakpoint is hit, you can see variables and add expression(s) to watch on the Debug Side Bar.

> To learn more about how to debug Arduino code, visit our [team blog](https://blogs.msdn.microsoft.com/iotdev/2017/05/27/debug-your-arduino-code-with-visual-studio-code/).

## Change Log
See the [Change log](https://github.com/FrankSAURET/vscode-arduino/blob/main/CHANGELOG.md) for details about the changes in each version.

## Supported Operating Systems
Currently this extension supports the following operating systems:

- Windows 7 and later (32-bit and 64-bit)
- macOS 10.10 and later
- Ubuntu 16.04
  - The extension might work on other Linux distributions, as reported by other users, but without guarantee.

## Contributing

Contributions are welcome! This is a community-maintained fork and we appreciate any help.

- **Report bugs**: Open an [issue](https://github.com/FrankSAURET/vscode-arduino/issues)
- **Suggest features**: Open an [issue](https://github.com/FrankSAURET/vscode-arduino/issues) with the `enhancement` label
- **Submit code**: Fork the repository, create a branch, and submit a [pull request](https://github.com/FrankSAURET/vscode-arduino/pulls)

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup details.

## Development

Installation prerequisites:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (>= 12.x)
- [Npm](https://www.npmjs.com/) (>= 6.x)

To *run and develop*, do the following:
- `git clone https://github.com/FrankSAURET/vscode-arduino`
- `cd vscode-arduino`
- Run `npm i`
- Run `npm i -g gulp`
- Open in Visual Studio Code (`code .`)
- Press <kbd>F5</kbd> to debug.

To *test*, press <kbd>F5</kbd> in VS Code with the "Launch Tests" debug configuration.

## Credits & License

This extension is a fork of [Microsoft/vscode-arduino](https://github.com/Microsoft/vscode-arduino) (© Microsoft Corporation), which was archived in 2023. It also incorporates ideas and fixes from the [vscode-arduino community fork](https://github.com/vscode-arduino/vscode-arduino).

Licensed under the [MIT License](LICENSE.txt). See the [Third Party Notices](ThirdPartyNotices.txt) file for additional copyright notices and terms.

## Contact Us
If you'd like to help improve this extension, open an issue or a pull request on [GitHub](https://github.com/FrankSAURET/vscode-arduino).
