## Dev Set up

1. Clone the repository
2. Navigate to the extension directory: `cd ui/vscode-extension`
3. Install dependencies: `npm install`
4. Install webview dependencies: `cd webview-ui && npm install`
5. Build the webview: `npm run build-webview`
6. Open the project in VSCode: `code .`
7. Press F5 to start debugging

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


## Testing

### Running Tests

In `ui/vscode-extesion` and `ui/vscode-extension/webviews`

`npm run test`

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

## Packaging and Releasing

### Packaging the Extension

The extension can be packaged into a `.vsix` file for distribution. There are several npm scripts available for packaging:

- `npm run package` - Runs tests, then packages the extension
- `npm run package:dist` - Runs tests, then packages the extension into the `dist` directory with version number
- `npm run package:skip-tests` - Skips tests and packages the extension

To package the extension for distribution:

```bash
cd ui/vscode-extension
npm run package:dist
```

This will create a `.vsix` file in the `dist` directory with the name `goose-vscode-[version].vsix`.

### Using the Release Script

A helper script is provided to simplify the release process:

```bash
cd ui/vscode-extension
./scripts/release.sh 0.1.0  # Replace with your desired version
```

This script:
1. Updates the version in `package.json`
2. Packages the extension to the `dist` directory
3. Provides instructions for creating a Git tag and pushing to GitHub

### GitHub Release Workflow

The repository includes a GitHub Actions workflow that automatically builds and releases the extension when a tag with the format `vscode-v*` is pushed to the repository.

The workflow:
1. Checks out the code
2. Sets up Node.js
3. Installs dependencies
4. Builds and packages the extension
5. Creates a GitHub release with the packaged extension attached

#### Releasing with Protected Branches

Since direct commits to the main branch are restricted, follow this process for releases:

1. Create a feature branch for the version update:
   ```bash
   git checkout -b release/vscode-v0.1.0
   ```

2. Update the version in `package.json` and make any other necessary changes
   ```bash
   cd ui/vscode-extension
   ./scripts/release.sh 0.1.0  # Creates the package and updates version
   ```

3. Commit the changes:
   ```bash
   git add .
   git commit -m "Bump vscode extension to v0.1.0"
   ```

4. Create a pull request and get it reviewed/approved

5. After the PR is merged to main, checkout the main branch and pull the latest changes:
   ```bash
   git checkout main
   git pull
   ```

6. Create and push the tag from the main branch:
   ```bash
   git tag vscode-v0.1.0
   git push origin vscode-v0.1.0
   ```

This will trigger the GitHub workflow to create a release with the packaged extension.

The workflow can also be triggered manually from the GitHub Actions tab, where you can specify the version to release.
