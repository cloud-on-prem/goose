## Dev Set up

1. Clone the repository
2. Set up the binary as described in the Requirements section
3. Run `npm install` to install dependencies
4. Run `npm run compile` to build the extension (in `ui/vscode-extension`)
5. Press F5 to launch the extension in a new VS Code window

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
