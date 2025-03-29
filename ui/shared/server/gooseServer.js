"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGoosed = exports.checkServerStatus = exports.findAvailablePort = void 0;
const child_process_1 = require("child_process");
const net_1 = require("net");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
// Default logger implementation that can be overridden
let logger = {
    info: (message, ...args) => console.info(`[GooseServer] ${message}`, ...args),
    error: (message, ...args) => console.error(`[GooseServer] ${message}`, ...args),
};
// Find an available port to start goosed on
const findAvailablePort = () => {
    return new Promise((resolve, _reject) => {
        const server = (0, net_1.createServer)();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => {
                logger.info(`Found available port: ${port}`);
                resolve(port);
            });
        });
    });
};
exports.findAvailablePort = findAvailablePort;
// Check if goosed server is ready by polling the status endpoint
const checkServerStatus = async (port, maxAttempts = 60, interval = 100) => {
    const statusUrl = `http://127.0.0.1:${port}/status`;
    logger.info(`Checking server status at ${statusUrl}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(statusUrl);
            if (response.ok) {
                logger.info(`Server is ready after ${attempt} attempts`);
                return true;
            }
        }
        catch (error) {
            // Expected error when server isn't ready yet
            if (attempt === maxAttempts) {
                logger.error(`Server failed to respond after ${maxAttempts} attempts:`, error);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
};
exports.checkServerStatus = checkServerStatus;
/**
 * Start the Goose server
 */
const startGoosed = async (config) => {
    // Set up logger if provided
    if (config.logger) {
        logger = config.logger;
    }
    // Set up the working directory (default to home dir if not specified)
    const homeDir = node_os_1.default.homedir();
    const isWindows = process.platform === 'win32';
    // Ensure directory is properly normalized for the platform
    let workingDir = config.workingDir || homeDir;
    workingDir = node_path_1.default.normalize(workingDir);
    // Get the goosed binary path using the provided function
    let goosedPath = config.getBinaryPath('goosed');
    const port = await (0, exports.findAvailablePort)();
    // Generate a secret key for secure communication
    const secretKey = generateSecretKey();
    logger.info(`Starting goosed from: ${goosedPath} on port ${port} in dir ${workingDir}`);
    // Define additional environment variables
    const additionalEnv = {
        // Set HOME for UNIX-like systems
        HOME: homeDir,
        // Set USERPROFILE for Windows
        USERPROFILE: homeDir,
        // Set APPDATA for Windows
        APPDATA: process.env.APPDATA || node_path_1.default.join(homeDir, 'AppData', 'Roaming'),
        // Set LOCAL_APPDATA for Windows
        LOCALAPPDATA: process.env.LOCALAPPDATA || node_path_1.default.join(homeDir, 'AppData', 'Local'),
        // Set PATH to include the binary directory
        PATH: `${node_path_1.default.dirname(goosedPath)}${node_path_1.default.delimiter}${process.env.PATH}`,
        // start with the port specified
        GOOSE_PORT: String(port),
        // Secret key for secure communication
        GOOSE_SERVER__SECRET_KEY: secretKey,
        // Add any additional environment variables passed in
        ...config.env,
    };
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
    }
    catch (error) {
        logger.error(`Binary not found at ${goosedPath}:`, error);
        throw new Error(`Binary not found at ${goosedPath}`);
    }
    const spawnOptions = {
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
    const goosedProcess = (0, child_process_1.spawn)(goosedPath, ['agent'], spawnOptions);
    // Only unref on Windows to allow it to run independently of the parent
    if (isWindows) {
        goosedProcess.unref();
    }
    goosedProcess.stdout.on('data', (data) => {
        logger.info(`goosed stdout for port ${port} and dir ${workingDir}: ${data.toString()}`);
    });
    goosedProcess.stderr.on('data', (data) => {
        logger.error(`goosed stderr for port ${port} and dir ${workingDir}: ${data.toString()}`);
    });
    goosedProcess.on('close', (code) => {
        logger.info(`goosed process exited with code ${code} for port ${port} and dir ${workingDir}`);
    });
    goosedProcess.on('error', (err) => {
        logger.error(`Failed to start goosed on port ${port} and dir ${workingDir}`, err);
        throw err; // Propagate the error
    });
    // Wait for the server to be ready
    const isReady = await (0, exports.checkServerStatus)(port);
    logger.info(`Goosed isReady ${isReady}`);
    if (!isReady) {
        logger.error(`Goosed server failed to start on port ${port}`);
        try {
            if (isWindows) {
                // On Windows, use taskkill to forcefully terminate the process tree
                (0, child_process_1.spawn)('taskkill', ['/pid', goosedProcess.pid.toString(), '/T', '/F']);
            }
            else {
                goosedProcess.kill();
            }
        }
        catch (error) {
            logger.error('Error while terminating goosed process:', error);
        }
        throw new Error(`Goosed server failed to start on port ${port}`);
    }
    // Set up cleanup handler if events are provided
    if (config.events) {
        config.events.on('will-quit', () => {
            logger.info('App quitting, terminating goosed server');
            try {
                if (isWindows) {
                    // On Windows, use taskkill to forcefully terminate the process tree
                    (0, child_process_1.spawn)('taskkill', ['/pid', goosedProcess.pid.toString(), '/T', '/F']);
                }
                else {
                    goosedProcess.kill();
                }
            }
            catch (error) {
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
exports.startGoosed = startGoosed;
// Helper function to generate a secure secret key
function generateSecretKey() {
    // Create a random string of 32 characters for the secret key
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const randomValues = new Uint8Array(32);
    crypto.getRandomValues(randomValues);
    randomValues.forEach(val => {
        result += chars[val % chars.length];
    });
    return result;
}
//# sourceMappingURL=gooseServer.js.map