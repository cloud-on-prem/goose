import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

/**
 * Get the path to the Goose binary by looking for the installed Goose Desktop application.
 * @param _context The VSCode extension context (currently unused but kept for potential future use)
 * @param binaryName The name of the binary to find (e.g., 'goosed')
 * @returns The absolute path to the binary
 */
export function getBinaryPath(_context: ExtensionContext, binaryName: string): string {
    const platform = process.platform;
    const homeDir = os.homedir();
    const isDev = process.env.NODE_ENV === 'development'; // Keep dev check for potential overrides

    // On Windows, use .exe suffix
    const executableName = platform === 'win32' ? `${binaryName}.exe` : binaryName;

    // Define potential base paths for the Goose Desktop installation
    const basePaths: string[] = [];

    if (platform === 'darwin') { // macOS
        // Check multiple potential paths for macOS - Electron apps can have different structures
        const macAppPaths = [
            '/Applications/Goose.app',
            path.join(homeDir, 'Applications/Goose.app')
        ];

        // For each base app path, check multiple possible locations where the binary could be
        for (const appPath of macAppPaths) {
            basePaths.push(
                // Standard Resources/app/bin structure
                path.join(appPath, 'Contents/Resources/app/bin'),
                // Direct Resources/bin structure
                path.join(appPath, 'Contents/Resources/bin'),
                // MacOS directory
                path.join(appPath, 'Contents/MacOS'),
                // Just Resources directory
                path.join(appPath, 'Contents/Resources'),
                // app.asar structure
                path.join(appPath, 'Contents/Resources/app.asar.unpacked/bin'),
                // Try Node modules bin - sometimes used for prebuilts in Electron apps
                path.join(appPath, 'Contents/Resources/app/node_modules/.bin')
            );
        }
    } else if (platform === 'win32') { // Windows
        const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';

        // Windows Electron app paths
        basePaths.push(
            path.join(localAppData, 'Programs', 'Goose', 'resources', 'app', 'bin'), // Default install location
            path.join(localAppData, 'Programs', 'Goose', 'resources', 'bin'),
            path.join(localAppData, 'Programs', 'Goose', 'resources', 'app.asar.unpacked', 'bin'),
            path.join(programFiles, 'Goose', 'resources', 'app', 'bin'), // Alternative install location
            path.join(programFiles, 'Goose', 'resources', 'bin'),
            path.join(programFiles, 'Goose', 'resources', 'app.asar.unpacked', 'bin')
        );
    } else { // Linux (assuming common locations)
        basePaths.push(
            '/opt/Goose/resources/app/bin', // Common install location
            '/opt/Goose/resources/bin',
            '/opt/Goose/resources/app.asar.unpacked/bin',
            '/usr/local/Goose/resources/app/bin',
            '/usr/local/Goose/resources/bin',
            '/usr/local/bin', // Global bin where the goosed might be symlinked
            path.join(homeDir, '.local/share/Goose/resources/app/bin'), // User-specific install
            path.join(homeDir, '.local/share/Goose/resources/bin'),
            path.join(homeDir, '.local/share/Goose/resources/app.asar.unpacked/bin')
        );
    }

    // Construct full possible paths
    const possiblePaths = basePaths.map(base => path.join(base, executableName));

    // --- Development Override ---
    // If in development, also check the target/release directory relative to the extension
    // This allows testing with a locally built binary without needing the full desktop app installed.
    if (isDev && _context) { // Check _context exists before using it
        // Add paths relative to the extension for development builds
        possiblePaths.unshift( // Add dev paths to the beginning of the search list
            path.join(_context.extensionPath, '..', '..', 'target', 'release', executableName),
            path.join(_context.extensionPath, '..', '..', '..', 'target', 'release', executableName)
        );
    }
    // --- End Development Override ---

    console.info('[Goose Ext] Checking for binary:', executableName, 'in paths:', possiblePaths);

    // Try each path and return the first one that exists
    for (const binPath of possiblePaths) {
        try {
            if (fs.existsSync(binPath)) {
                console.info(`[Goose Ext] Found binary at: ${binPath}`);
                // Ensure the file is executable (especially on Unix-like systems)
                if (platform !== 'win32') {
                    try {
                        fs.accessSync(binPath, fs.constants.X_OK);
                    } catch (execError) {
                        console.warn(`[Goose Ext] Binary found at ${binPath} but is not executable. Attempting to chmod.`);
                        try {
                            fs.chmodSync(binPath, 0o755); // Set executable permissions
                            console.info(`[Goose Ext] Successfully set executable permission for ${binPath}`);
                        } catch (chmodError) {
                            console.error(`[Goose Ext] Failed to set executable permission for ${binPath}:`, chmodError);
                            // Continue checking other paths, maybe another one works
                            continue;
                        }
                    }
                }
                return binPath;
            }
        } catch (error) {
            // Log errors during checks but continue trying other paths
            console.error(`[Goose Ext] Error checking path ${binPath}:`, error);
        }
    }

    // If we get here, we couldn't find the binary
    const errorMsg = `Could not find the '${executableName}' binary. Please ensure the Goose Desktop application is installed correctly in a standard location. Checked paths: ${possiblePaths.join(', ')}`;
    console.error(`[Goose Ext] ${errorMsg}`);
    vscode.window.showErrorMessage(errorMsg); // Show error to the user
    throw new Error(errorMsg);
} 
