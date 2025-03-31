# Goose VSCode Extension

This extension brings Goose AI functionality to Visual Studio Code.

## Features

* Interactive chat UI
* Access to Goose's AI capabilities directly within VSCode
* Support for coding assistance, explanations, and more
* Code referencing with visual chips in the chat UI
* Quick actions for common coding tasks
* Code action suggestions for diagnostics and selection

## Requirements

> ⚠️ **VSCode 1.98.0 or higher is required** for this extension to function properly.

> ⚠️ **Goose Desktop must be installed** before using this extension. This extension spawns `goosed` and uses the API which is already bundled with the Desktop App.

## Installation

There are two ways to install the Goose VSCode Extension:

### Method 1: Install from GitHub Releases

1. Go to the [GitHub Releases page](https://github.com/cloud-on-prem/goose/releases)
2. Find the latest release with the tag `vscode-v*`
3. Download the `.vsix` file
4. In VS Code, go to the Extensions view (Ctrl+Shift+X)
5. Click on the "..." menu at the top of the Extensions view
6. Select "Install from VSIX..."
7. Locate and select the downloaded `.vsix` file
8. Restart VS Code if prompted

### Method 2: Install from VS Code Marketplace (Coming soon)

The extension will be available in the VS Code Marketplace in the future.

### Chat Interface

The Goose chat interface appears in the sidebar activity bar. Click the Goose icon to open the chat panel.

### Code References

You can reference code from your editor in your conversations with Goose:

1. Select code in your editor
2. Right-click and choose "Ask Goose about this code" or any of the quick action commands
3. The code will be added as a reference chip above the input box
4. Type your question and send

### Quick Actions

The extension currently provides the following quick action command that can be accessed by right-clicking on selected code:

* **Ask Goose about this code** - General question about the selected code

## Extension Settings

This extension contributes the following settings:

* `goose.enable`: enable/disable this extension

----

## Dev Notes
Refer to [DEVELOPMENT](./DEVELOPMENT.md)

## Known Issues

Refer to the GitHub issues page for any known issues.

## License

This extension is licensed under the MIT License.

