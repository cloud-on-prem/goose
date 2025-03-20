import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

/**
 * Get the path to the Goose binary based on the current environment
 * @param context The VSCode extension context
 * @param binaryName The name of the binary to find
 * @returns The absolute path to the binary
 */
export function getBinaryPath(context: ExtensionContext, binaryName: string): string {
    const isWindows = process.platform === 'win32';
    const isDev = process.env.NODE_ENV === 'development';

    // On Windows, use .exe suffix
    const executableName = isWindows ? `${binaryName}.exe` : binaryName;

    // List of possible paths to check
    const possiblePaths: string[] = [];

    if (isDev) {
        // In development, check multiple possible locations
        possiblePaths.push(
            path.join(context.extensionPath, '..', '..', 'target', 'release', executableName),
            path.join(context.extensionPath, '..', '..', '..', 'target', 'release', executableName),
            path.join(process.cwd(), 'target', 'release', executableName)
        );
    } else {
        // In production/packaged extension
        possiblePaths.push(
            path.join(context.extensionPath, 'bin', executableName)
        );
    }

    // Log all paths we're checking
    console.info('Checking binary paths:', possiblePaths);

    // Try each path and return the first one that exists
    for (const binPath of possiblePaths) {
        try {
            if (fs.existsSync(binPath)) {
                console.info(`Found binary at: ${binPath}`);
                return binPath;
            }
        } catch (error) {
            console.error(`Error checking path ${binPath}:`, error);
        }
    }

    // If we get here, we couldn't find the binary
    const error = `Could not find ${binaryName} binary in any of the expected locations: ${possiblePaths.join(', ')}`;
    console.error(error);
    throw new Error(error);
} 
