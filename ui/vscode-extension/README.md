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

You need have Goose Desktop installed (This extension just spawns goosed which is bundled with the Desktop App)

## Installation


### Chat Interface

The Goose chat interface appears in the sidebar activity bar. Click the Goose icon to open the chat panel.

### Code References

You can reference code from your editor in your conversations with Goose:

1. Select code in your editor
2. Right-click and choose "Ask Goose about this code" or any of the quick action commands
3. The code will be added as a reference chip above the input box
4. Type your question and send

### Quick Actions

The extension provides several quick action commands that can be accessed by right-clicking on selected code:

* **Ask Goose about this code** - General question about the selected code
* **Ask Goose to explain this code** - Get an explanation of what the code does
* **Ask Goose to generate tests** - Generate unit tests for the selected code
* **Ask Goose to optimize this code** - Get suggestions on how to optimize the code
* **Ask Goose to fix issues** - Get help fixing bugs or issues in the code
* **Ask Goose to document this code** - Generate documentation for the code

### Code Action Suggestions

The extension also provides code actions in the editor:

1. When there are diagnostics (errors/warnings) in your code, you'll see a "Fix with Goose" code action
2. When you select code, you'll see actions like "Explain with Goose" and "Optimize with Goose"

### Workspace Context

The extension is context-aware and takes into account your workspace environment:

1. Click the context indicator in the top-right of the chat panel to see current context
2. Use the "Ask About Current Issues" button to get help with current diagnostics
3. The extension automatically includes relevant context information in your conversations

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

