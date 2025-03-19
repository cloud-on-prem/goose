# Goose VSCode Extension

A VSCode extension that integrates with the Goose AI agent to provide intelligent assistance directly within your editor.

## Features

- Chat interface for AI assistance
- Code-aware interactions
- Integrated Goose AI agent support

## Development Status

- [x] Project setup and scaffolding
  - [x] Create extension project structure
  - [x] Set up Vite for WebView UI development
  - [x] Configure TypeScript, ESLint, and Prettier
  - [x] Set up basic messaging between extension host and WebView
  - [x] Create a simple WebView panel that can be opened from VSCode
  - [x] Write basic tests for extension activation

- [ ] Goose Server Integration
- [ ] Basic Chat UI Implementation
- [ ] VSCode Integration Features
- [ ] Advanced Chat Features
- [ ] Settings and Configuration
- [ ] Polish and Optimization
- [ ] Testing and Documentation
- [ ] Packaging and Distribution

## Architecture

The extension consists of three main components:

1. **VSCode Extension Host** - The main extension code that integrates with VSCode's API
2. **WebView UI** - A React-based UI for chat interaction, reusing components from the Goose desktop app
3. **Goose Server Integration** - Code to start, connect to, and communicate with the Goose backend server

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

- `Goose Wingman: Hello World` - Displays a simple greeting message
- `Goose Wingman: Start` - Opens the Goose Wingman chat interface

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
3. For future UI component testing, consider adding a testing library like Jest or Vitest

## License

Copyright © 2024 Goose AI
