# Goose VSCode Extension

This extension brings Goose AI functionality to Visual Studio Code.

## Features

* Interactive chat UI similar to Cursor.so
* Access to Goose's AI capabilities directly within VSCode
* Support for coding assistance, explanations, and more
* Code referencing with visual chips in the chat UI
* Context-aware assistance based on your workspace
* Quick actions for common coding tasks
* Code action suggestions for diagnostics and selection

## Requirements

The extension requires the Goose backend server to function properly:

1. You need the `goosed` binary in your extension's `bin` directory
2. If developing locally, copy the binary from `ui/desktop/src/bin/goosed` to `ui/vscode-extension/bin/`
3. Run the following command:
   ```bash
   mkdir -p bin && cp ../desktop/src/bin/goosed bin/
   ```

## Installation

1. Clone the repository
2. Set up the binary as described in the Requirements section
3. Run `npm install` to install dependencies
4. Run `npm run compile` to build the extension
5. Press F5 to launch the extension in a new VS Code window

## Usage

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

## Known Issues

Refer to the GitHub issues page for any known issues.

## Development Status

- [x] Project setup and scaffolding
  - [x] Create extension project structure
  - [x] Set up Vite for WebView UI development
  - [x] Configure TypeScript, ESLint, and Prettier
  - [x] Set up basic messaging between extension host and WebView
  - [x] Create a simple WebView panel that can be opened from VSCode
  - [x] Write basic tests for extension activation

- [x] Goose Server Integration
  - [x] Implement Goose server initialization and management
  - [x] Create utilities for server communication
  - [x] Add error handling and reconnection logic
  - [x] Set up secure messaging between the WebView and Goose server
  - [x] Implement a sidebar view similar to Cursor for the chat interface
  - [x] Test server startup and communication

- [x] Basic Chat UI Implementation
  - [x] Create chat container component
  - [x] Implement message display components for user and AI messages
  - [x] Add basic chat input functionality
  - [x] Implement markdown rendering for responses
  - [x] Style the chat interface using VS Code theme variables
  - [x] Add loading indicators and error states
  - [x] Add message state management for proper conversation history
  - [x] Add empty state message handling
  - [x] Implement proper message styling and layout
  - [x] Add markdown rendering of messages
  - [x] Add scroll positioning when new messages are added
  - [x] Add "Generating" message indicator
  - [x] Add ability to copy messages to clipboard

- [x] VSCode Integration Features
  - [x] Add ability to reference code from the editor
  - [x] Implement code chips for references in messages
  - [x] Create commands for quick actions (explain code, fix issues, etc.)
  - [x] Add context awareness (current file, language, project type)
  - [x] Implement code action suggestions for diagnostics
  - [x] Add workspace context information panel
  - [x] Integrate with diagnostics for error fixing

## License

This extension is licensed under the MIT License.

## Architecture

The extension consists of three main components:

1. **VSCode Extension Host** - The main extension code that integrates with VSCode's API
2. **WebView UI** - A React-based UI for chat interaction, reusing components from the Goose desktop app
3. **Goose Server Integration** - Code to start, connect to, and communicate with the Goose backend server

### Server Integration

The extension includes a robust server integration layer that:

- Manages the lifecycle of the Goose server process
- Handles secure communication with authentication
- Processes streaming responses from the AI
- Manages error handling and recovery
- Provides a clean API for the WebView to interact with

## Server API Endpoints

The extension communicates with the Goose server using the following API endpoints:

### Agent Management

#### Get Available Versions
- **Endpoint**: `GET /agent/versions`
- **Description**: Retrieves available agent versions
- **Response**: JSON containing available versions and default version
```json
{
  "available_versions": ["v1", "v2"],
  "default_version": "v2"
}
```

#### List AI Providers
- **Endpoint**: `GET /agent/providers`
- **Description**: Lists available AI model providers
- **Response**: JSON array of providers with details

#### Create Agent
- **Endpoint**: `POST /agent`
- **Authentication**: Required
- **Request Body**:
```json
{
  "version": "v2",  // Optional, defaults to the default version
  "provider": "openai",
  "model": "gpt-4"  // Optional, will use env var if not provided
}
```
- **Response**: JSON with agent version created

#### Extend Agent Prompt
- **Endpoint**: `POST /agent/prompt`
- **Authentication**: Required
- **Request Body**:
```json
{
  "extension": "Additional prompt text..."
}
```
- **Response**: Success status

### Session Management

#### List Sessions
- **Endpoint**: `GET /sessions`
- **Authentication**: Required
- **Response**: JSON array of available sessions

#### Get Session History
- **Endpoint**: `GET /sessions/:session_id`
- **Authentication**: Required
- **Response**: JSON containing session metadata and message history

### Message Exchange

#### Chat (Streaming)
- **Endpoint**: `POST /reply`
- **Authentication**: Required
- **Request Body**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Your prompt here"
    }
  ],
  "session_id": "optional-session-id",
  "session_working_dir": "/path/to/working/directory"
}
```
- **Response**: Server-Sent Events (SSE) stream with message events
- **Event Types**:
  - `Message`: Contains message content
  - `Error`: Contains error information
  - `Finish`: Indicates completion of the response

#### Simple Ask
- **Endpoint**: `POST /reply/ask`
- **Authentication**: Required
- **Request Body**:
```json
{
  "prompt": "Your question here",
  "session_id": "optional-session-id",
  "session_working_dir": "/path/to/working/directory"
}
```
- **Response**: JSON with response text

#### Tool Confirmation
- **Endpoint**: `POST /reply/confirm`
- **Authentication**: Required
- **Request Body**:
```json
{
  "id": "tool-request-id",
  "confirmed": true
}
```
- **Response**: JSON with status

## Getting Started

### Development

1. Clone the repository
2. Navigate to the extension directory: `cd ui/vscode-extension`
3. Install dependencies: `npm install`
4. Install webview dependencies: `cd webview-ui && npm install`
5. Build the webview: `npm run build-webview`
6. Open the project in VSCode: `code .`
7. Press F5 to start debugging

### Commands

The extension provides the following commands:

- `Goose: Hello World` - Displays a simple greeting message
- `Goose: Start` - Opens the Goose chat interface
- `Goose: Start Server` - Manually starts the Goose server
- `Goose: Stop Server` - Manually stops the Goose server

## Testing

### Running Tests

The extension uses VSCode's built-in testing framework. You can run tests in several ways:

1. **Command Line**: Run all tests with `npm test`
2. **VSCode Interface**:
   - Open the Testing panel in VSCode (Test tube icon in the sidebar)
   - Click the play button to run all tests or right-click on a specific test to run it individually

### Test Structure

- Tests are located in `src/test/` directory
- `extension.test.ts` contains tests for the extension functionality
- `unit/serverManager.test.ts` contains tests for the server management functionality

### Writing Tests

When writing new tests:

1. Add test cases to the appropriate test file
2. Follow the existing pattern using `suite()` for test groups and `test()` for individual tests
3. Use `assert` functions from the Node.js assert module for validations

### Debugging Tests

To debug tests:

1. Set breakpoints in your test files
2. Use the "Extension Tests" launch configuration from `.vscode/launch.json`
3. Select "Debug Tests" from the Testing panel's menu

### WebView UI Testing

For testing the webview UI components:

1. Navigate to the webview directory: `cd webview-ui`
2. Run type-checking: `npm run type-check`
