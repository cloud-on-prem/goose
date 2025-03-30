# Goose VSCode Extension Webview UI

This directory contains the React-based webview UI for the Goose VSCode Extension. The webview provides a user interface for interacting with the Goose AI assistant within Visual Studio Code.

## Project Structure

The UI is built using:
- React with TypeScript
- Vite for build tooling
- Vitest for testing
- Tailwind CSS for styling

### Components

The application consists of the following key components:

- **App**: The main application component that handles state management and orchestrates the UI
- **Header**: Displays the application header, server status, and session information
- **SessionIndicator**: Shows the current session and provides a way to toggle the session drawer
- **SessionList**: Displays a list of available sessions and allows switching between them
- **WorkspaceContext**: Provides context information about the current workspace

## Testing

The project includes comprehensive tests for all major components. Tests are implemented using:
- Vitest as the test runner
- React Testing Library for component testing
- JSDOM for simulating a browser environment

### Running Tests

To run the tests:

```bash
npm test
```

To run tests with coverage:

```bash
npm test -- --coverage
```

### Test Files

The following test files are available:

1. `App.test.tsx` - Tests for the main App component
2. `Header.test.tsx` - Tests for the Header component
3. `SessionIndicator.test.tsx` - Tests for the SessionIndicator component
4. `SessionList.test.tsx` - Tests for the SessionList component
5. `WorkspaceContext.test.tsx` - Tests for workspace context functionality
6. `Messages.test.tsx` - Tests for message rendering
7. `Input.test.tsx` - Tests for input handling

## Coverage

Current test coverage (as of the latest run):

| File                 | % Stmts | % Branch | % Funcs | % Lines |
|----------------------|---------|----------|---------|---------|
| All components       | 98.98   | 89.65    | 100     | 98.98   |
| Header.tsx           | 100     | 100      | 100     | 100     |
| SessionIndicator.tsx | 100     | 100      | 100     | 100     |
| SessionList.tsx      | 97.95   | 75       | 100     | 97.95   |

Areas for improvement:
- Increase branch coverage in SessionList.tsx
- Add more tests for the main App.tsx file
- Add tests for additional components

## Development

To start the development server:

```bash
npm run dev
```

## Building

To build the project:

```bash
npm run build
``` 
