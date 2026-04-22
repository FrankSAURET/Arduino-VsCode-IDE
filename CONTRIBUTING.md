# Contributing to VS Code extension for Arduino

Welcome, and thank you for your interest in contributing to this community-maintained fork of the VS Code extension for Arduino!

This project is a fork of the [original Microsoft extension](https://github.com/Microsoft/vscode-arduino) (now archived) and builds upon work from the [community fork](https://github.com/vscode-arduino/vscode-arduino). All contributions — bug reports, feature requests, documentation improvements, and code — are welcome.

## Getting Started

1. Fork and clone the repository:
   ```
   git clone https://github.com/FrankSAURET/Arduino-VsCode-IDE
   cd Arduino-VsCode-IDE
   ```
2. Install dependencies:
   ```
   npm install
   npm install -g gulp
   ```
3. Open in VS Code (`code .`) and press <kbd>F5</kbd> to launch the extension in debug mode.

## Contributing Fixes and Features

- Work against the [main](https://github.com/FrankSAURET/Arduino-VsCode-IDE/tree/main) branch.
- Submit pull requests to `main`.
- Look at the [open issues](https://github.com/FrankSAURET/Arduino-VsCode-IDE/issues) for ideas — especially those labelled `help wanted` or `good first issue`.
- Keep changes focused: one pull request per fix or feature.

## Reporting Issues

Before creating a new issue, search the [existing issues](https://github.com/FrankSAURET/Arduino-VsCode-IDE/issues) to avoid duplicates.

Please include:

* Version of VS Code and this extension
* OS/Platform
* Reproducible steps (1... 2... 3...)
* Expected vs. actual behaviour
* Screenshots or logs if applicable
* Errors from the Dev Tools Console (Help > Toggle Developer Tools > Console)

## Code Style

- Follow the existing TypeScript style (see `tslint.json`).
- Run `npx tsc --noEmit` before submitting to check for compilation errors.
- Do not add telemetry or tracking of any kind.

# Thank You!

Your contributions to open source, large or small, make great projects like this possible. Thank you for taking the time to contribute.

