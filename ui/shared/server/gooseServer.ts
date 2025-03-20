import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { createServer } from 'net';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import EventEmitter from 'events';

// Default logger implementation that can be overridden
let logger = {
    info: (message: string, ...args: any[]) => console.info(`[GooseServer] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[GooseServer] ${message}`, ...args),
};

export interface GooseServerConfig {
    // Custom logger for server output
    logger?: {
        info: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
    };
    // Optional working directory for the server
    workingDir?: string;
    // Additional environment variables for the server
    env?: Record<string, string>;
    // Function to get the binary path (allows environment-specific implementation)
    getBinaryPath: (binaryName: string) => string;
    // Optional event emitter for lifecycle events (replaces Electron app dependency)
    events?: EventEmitter;
    // Optional fixed secret key for authentication
    secretKey?: string;
}

// Event system to replace direct Electron app dependency
interface ServerLifecycleEvents {
    onWillQuit: (callback: () => void) => void;
}

// Find an available port to start goosed on
export const findAvailablePort = (): Promise<number> => {
    return new Promise((resolve, _reject) => {
        const server = createServer();

        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as { port: number };
            server.close(() => {
                logger.info(`Found available port: ${port}`);
                resolve(port);
            });
        });
    });
};

// Check if goosed server is ready by polling the status endpoint
export const checkServerStatus = async (
    port: number,
    maxAttempts: number = 60,
    interval: number = 100
): Promise<boolean> => {
    const statusUrl = `http://127.0.0.1:${port}/status`;
    logger.info(`Checking server status at ${statusUrl}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(statusUrl);
            if (response.ok) {
                logger.info(`Server is ready after ${attempt} attempts`);
                return true;
            }
        } catch (error) {
            // Expected error when server isn't ready yet
            if (attempt === maxAttempts) {
                logger.error(`Server failed to respond after ${maxAttempts} attempts:`, error);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
};

// Interface for the return value of startGoosed
export interface GooseServerInfo {
    port: number;
    workingDir: string;
    process: ChildProcess;
    secretKey: string;
}

/**
 * Start the Goose server
 */
export const startGoosed = async (
    config: GooseServerConfig
): Promise<GooseServerInfo> => {
    // Set up logger if provided
    if (config.logger) {
        logger = config.logger;
    }

    // Set up the working directory (default to home dir if not specified)
    const homeDir = os.homedir();
    const isWindows = process.platform === 'win32';

    // Ensure directory is properly normalized for the platform
    let workingDir = config.workingDir || homeDir;
    workingDir = path.normalize(workingDir);

    // Get the goosed binary path using the provided function
    let goosedPath = config.getBinaryPath('goosed');
    const port = await findAvailablePort();

    // Use the provided secret key or generate a new one
    const secretKey = config.secretKey || generateSecretKey();

    logger.info(`Starting goosed from: ${goosedPath} on port ${port} in dir ${workingDir}`);

    // Define additional environment variables
    const additionalEnv: Record<string, string> = {
        // Set HOME for UNIX-like systems
        HOME: homeDir,
        // Set USERPROFILE for Windows
        USERPROFILE: homeDir,
        // Set APPDATA for Windows
        APPDATA: process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'),
        // Set LOCAL_APPDATA for Windows
        LOCALAPPDATA: process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'),
        // Set PATH to include the binary directory
        PATH: `${path.dirname(goosedPath)}${path.delimiter}${process.env.PATH}`,
        // start with the port specified
        GOOSE_PORT: String(port),
        // Secret key for secure communication
        GOOSE_SERVER__SECRET_KEY: secretKey,
    };

    // Forward any API key environment variables if they exist
    const apiKeyEnvVars = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'DATABRICKS_HOST',
        'DATABRICKS_TOKEN',
        'AZURE_OPENAI_API_KEY',
        'AZURE_OPENAI_ENDPOINT',
        'OLLAMA_HOST'
    ];

    for (const envVar of apiKeyEnvVars) {
        if (process.env[envVar]) {
            additionalEnv[envVar] = process.env[envVar];
            logger.info(`Forwarding environment variable ${envVar} to server process`);
        }
    }

    // Add any additional environment variables passed in
    if (config.env) {
        Object.assign(additionalEnv, config.env);
    }

    // Merge parent environment with additional environment variables
    const processEnv = { ...process.env, ...additionalEnv };

    // Add detailed logging for troubleshooting
    logger.info(`Process platform: ${process.platform}`);
    logger.info(`Process cwd: ${process.cwd()}`);
    logger.info(`Target working directory: ${workingDir}`);
    logger.info(`Environment HOME: ${processEnv.HOME}`);
    logger.info(`Environment USERPROFILE: ${processEnv.USERPROFILE}`);
    logger.info(`Environment APPDATA: ${processEnv.APPDATA}`);
    logger.info(`Environment LOCALAPPDATA: ${processEnv.LOCALAPPDATA}`);

    // Ensure proper executable path on Windows
    if (isWindows && !goosedPath.toLowerCase().endsWith('.exe')) {
        goosedPath += '.exe';
    }
    logger.info(`Binary path resolved to: ${goosedPath}`);

    // Verify binary exists
    try {
        const fs = require('fs');
        const stats = fs.statSync(goosedPath);
        logger.info(`Binary exists: ${stats.isFile()}`);
    } catch (error) {
        logger.error(`Binary not found at ${goosedPath}:`, error);
        throw new Error(`Binary not found at ${goosedPath}`);
    }

    const spawnOptions: SpawnOptions = {
        cwd: workingDir,
        env: processEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        // Hide terminal window on Windows
        windowsHide: true,
        // Run detached on Windows only to avoid terminal windows
        detached: isWindows,
        // Never use shell to avoid terminal windows
        shell: false,
    };

    // Log spawn options for debugging
    logger.info('Spawn options:', JSON.stringify(spawnOptions, null, 2));

    // Spawn the goosed process
    const goosedProcess = spawn(goosedPath, ['agent'], spawnOptions);

    // Only unref on Windows to allow it to run independently of the parent
    if (isWindows) {
        goosedProcess.unref();
    }

    goosedProcess.stdout?.on('data', (data: Buffer) => {
        logger.info(`goosed stdout for port ${port} and dir ${workingDir}: ${data.toString()}`);
    });

    goosedProcess.stderr?.on('data', (data: Buffer) => {
        logger.error(`goosed stderr for port ${port} and dir ${workingDir}: ${data.toString()}`);
    });

    goosedProcess.on('close', (code: number | null) => {
        logger.info(`goosed process exited with code ${code} for port ${port} and dir ${workingDir}`);
    });

    goosedProcess.on('error', (err: Error) => {
        logger.error(`Failed to start goosed on port ${port} and dir ${workingDir}`, err);
        throw err; // Propagate the error
    });

    // Wait for the server to be ready
    const isReady = await checkServerStatus(port);
    logger.info(`Goosed isReady ${isReady}`);
    if (!isReady) {
        logger.error(`Goosed server failed to start on port ${port}`);
        try {
            if (isWindows && goosedProcess.pid) {
                // On Windows, use taskkill to forcefully terminate the process tree
                spawn('taskkill', ['/pid', goosedProcess.pid.toString(), '/T', '/F']);
            } else {
                goosedProcess.kill();
            }
        } catch (error) {
            logger.error('Error while terminating goosed process:', error);
        }
        throw new Error(`Goosed server failed to start on port ${port}`);
    }

    // Set up cleanup handler if events are provided
    if (config.events) {
        config.events.on('will-quit', () => {
            logger.info('App quitting, terminating goosed server');
            try {
                if (isWindows && goosedProcess.pid) {
                    // On Windows, use taskkill to forcefully terminate the process tree
                    spawn('taskkill', ['/pid', goosedProcess.pid.toString(), '/T', '/F']);
                } else {
                    goosedProcess.kill();
                }
            } catch (error) {
                logger.error('Error while terminating goosed process:', error);
            }
        });
    }

    logger.info(`Goosed server successfully started on port ${port}`);
    return {
        port,
        workingDir,
        process: goosedProcess,
        secretKey
    };
};

// Helper function to generate a secure secret key
function generateSecretKey(): string {
    // Create a random string of 32 characters for the secret key
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    try {
        // Try to use Node.js crypto
        const crypto = require('crypto');
        const randomBytes = crypto.randomBytes(32);
        for (let i = 0; i < randomBytes.length; i++) {
            result += chars[randomBytes[i] % chars.length];
        }
    } catch (error) {
        // Fallback to browser crypto
        const randomValues = new Uint8Array(32);
        crypto.getRandomValues(randomValues);
        randomValues.forEach(val => {
            result += chars[val % chars.length];
        });
    }

    return result;
} 
