import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { GooseServerConfig, GooseServerInfo, startGoosed } from '../shared/server/gooseServer';
import { ApiClient } from '../shared/server/apiClient';
import { getBinaryPath } from '../utils/binaryPath';
import { Message } from '../shared/types';
import * as cp from 'child_process';
import * as crypto from 'crypto';

/**
 * Server status options
 */
export enum ServerStatus {
    STOPPED = 'stopped',
    STARTING = 'starting',
    RUNNING = 'running',
    ERROR = 'error'
}

/**
 * Events emitted by the server manager
 */
export enum ServerEvents {
    STATUS_CHANGE = 'statusChange',
    ERROR = 'error',
    MESSAGE = 'message',
    SERVER_EXIT = 'serverExit'
}

/**
 * Server manager for the VSCode extension
 */
export class ServerManager {
    private serverInfo: GooseServerInfo | null = null;
    private apiClient: ApiClient | null = null;
    private status: ServerStatus = ServerStatus.STOPPED;
    private eventEmitter: EventEmitter;
    private context: vscode.ExtensionContext;
    private extensionEvents: EventEmitter;
    private secretKey: string;
    private serverProcess: cp.ChildProcess | null = null;
    private static readonly SECRET_KEY_STORAGE_KEY = 'goose-server-secret-key';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.eventEmitter = new EventEmitter();
        this.extensionEvents = new EventEmitter();

        // Get or generate a secret key
        this.secretKey = this.getOrGenerateSecretKey();

        // Register cleanup on extension deactivation
        context.subscriptions.push({
            dispose: () => this.stop()
        });
    }

    /**
     * Get the existing secret key from storage or generate a new one
     */
    private getOrGenerateSecretKey(): string {
        // Try to get the key from storage
        const existingKey = this.context.globalState.get<string>(ServerManager.SECRET_KEY_STORAGE_KEY);

        if (existingKey) {
            console.log('Using existing secret key from storage');
            return existingKey;
        }

        // Generate a new random key
        console.log('Generating new random secret key');
        const newKey = this.generateSecretKey();

        // Store it for future use
        this.context.globalState.update(ServerManager.SECRET_KEY_STORAGE_KEY, newKey);
        console.log('Generated and stored new secret key');

        return newKey;
    }

    /**
     * Generate a secure random secret key
     */
    private generateSecretKey(): string {
        // Create a random string of 32 characters
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';

        try {
            const randomBytes = crypto.randomBytes(32);
            for (let i = 0; i < randomBytes.length; i++) {
                result += chars[randomBytes[i] % chars.length];
            }
        } catch (error) {
            // Fallback if crypto fails
            console.error('Error generating random bytes, using fallback:', error);
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
        }

        return result;
    }

    /**
     * Start the Goose server
     */
    public async start(): Promise<boolean> {
        if (this.status !== ServerStatus.STOPPED) {
            console.log('Server is already running or starting');
            return false;
        }

        this.setStatus(ServerStatus.STARTING);
        console.log('Starting Goose server...');

        // Log partial secret key for debugging (without revealing the full key)
        const keyPrefix = this.secretKey.substring(0, 4);
        const keySuffix = this.secretKey.substring(this.secretKey.length - 4);
        console.log(`Using secret key: ${keyPrefix}...${keySuffix} (${this.secretKey.length} chars)`);

        try {
            // Configure and start the server
            const serverConfig: GooseServerConfig = {
                workingDir: this.getWorkspaceDirectory(),
                getBinaryPath: (binaryName: string) => getBinaryPath(this.context, binaryName),
                logger: {
                    info: (message: string, ...args: any[]) => console.info(`[GooseServer] ${message}`, ...args),
                    error: (message: string, ...args: any[]) => console.error(`[GooseServer] ${message}`, ...args)
                },
                events: this.extensionEvents,
                secretKey: this.secretKey
            };

            this.serverInfo = await startGoosed(serverConfig);

            // Set up process exit handler
            this.serverInfo.process.on('close', (code) => {
                console.log(`Server process exited with code ${code}`);
                this.setStatus(ServerStatus.STOPPED);
                this.eventEmitter.emit(ServerEvents.SERVER_EXIT, code);
            });

            // Create API client for the server
            this.apiClient = new ApiClient({
                baseUrl: `http://127.0.0.1:${this.serverInfo.port}`,
                secretKey: this.secretKey,
                debug: true,
                logger: {
                    info: (message: string, ...args: any[]) => console.info(`[ApiClient] ${message}`, ...args),
                    error: (message: string, ...args: any[]) => console.error(`[ApiClient] ${message}`, ...args)
                }
            });

            // Configure the agent
            await this.configureAgent();

            this.setStatus(ServerStatus.RUNNING);
            return true;
        } catch (error) {
            console.error('Error starting Goose server:', error);
            this.setStatus(ServerStatus.ERROR);
            this.eventEmitter.emit(ServerEvents.ERROR, error);
            return false;
        }
    }

    /**
     * Configure the agent with appropriate provider and settings
     */
    private async configureAgent(): Promise<void> {
        if (!this.apiClient) {
            console.error('Cannot configure agent: API client not initialized');
            return;
        }

        try {
            console.info('Configuring Goose agent...');

            // Use Databricks with Claude model by default - doesn't require API keys
            let providerToUse = 'databricks';
            let modelToUse = 'claude-3-7-sonnet';
            let versionToUse = 'truncate'; // Default version

            try {
                // Get available versions first
                const versions = await this.apiClient.getAgentVersions();
                console.info(`Available versions: ${JSON.stringify(versions)}`);

                if (versions && versions.default_version) {
                    versionToUse = versions.default_version;
                    console.info(`Using default version: ${versionToUse}`);
                }
            } catch (err) {
                console.error('Error getting versions, using default:', err);
                // Continue with default version
            }

            // Create the agent with Databricks provider
            try {
                console.info(`Creating agent with provider: ${providerToUse}, model: ${modelToUse}`);

                const agentResult = await this.apiClient.createAgent(
                    providerToUse,  // Use databricks provider
                    modelToUse,      // Specify Claude model explicitly
                    versionToUse     // Use the version we determined
                );

                console.info(`Agent created successfully: ${JSON.stringify(agentResult)}`);

                // Extend the agent with the VSCode developer extension
                try {
                    await this.apiClient.addExtension('developer');
                    console.info('Added developer extension to agent');
                } catch (promptErr) {
                    console.error('Failed to add developer extension:', promptErr);
                    // Continue even if extension addition fails
                }

            } catch (agentErr) {
                console.error(`Failed to create agent with provider ${providerToUse}:`, agentErr);
                throw agentErr; // Re-throw the error
            }

        } catch (error) {
            console.error('Error configuring agent:', error);
            this.eventEmitter.emit(ServerEvents.ERROR, error);
            throw error;
        }
    }

    /**
     * Stop the Goose server
     */
    public stop(): void {
        if (this.serverInfo?.process) {
            console.info('Stopping Goose server');

            try {
                if (process.platform === 'win32' && this.serverInfo.process.pid) {
                    const { spawn } = require('child_process');
                    spawn('taskkill', ['/pid', this.serverInfo.process.pid.toString(), '/T', '/F']);
                } else {
                    this.serverInfo.process.kill();
                }
            } catch (error) {
                console.error('Error stopping Goose server:', error);
            }

            this.serverInfo = null;
            this.apiClient = null;
            this.setStatus(ServerStatus.STOPPED);
        }
    }

    /**
     * Restart the Goose server
     */
    public async restart(): Promise<boolean> {
        this.stop();
        return await this.start();
    }

    /**
     * Get the server status
     */
    public getStatus(): ServerStatus {
        return this.status;
    }

    /**
     * Get the API client
     */
    public getApiClient(): ApiClient | null {
        return this.apiClient;
    }

    /**
     * Get the server port
     */
    public getPort(): number | null {
        return this.serverInfo?.port || null;
    }

    /**
     * Send a chat message and stream the response
     */
    public async sendChatMessage(
        messages: Message[],
        abortController?: AbortController
    ): Promise<Response | null> {
        if (!this.apiClient || this.status !== ServerStatus.RUNNING) {
            throw new Error('Server is not running');
        }

        try {
            // Get the current workspace directory
            let workingDir = process.cwd();

            // If VSCode has an active workspace folder, use that instead
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                workingDir = workspaceFolders[0].uri.fsPath;
            }

            return await this.apiClient.streamChatResponse(
                messages,
                abortController,
                undefined, // No session ID for now
                workingDir
            );
        } catch (error) {
            console.error('Error sending chat message:', error);
            this.eventEmitter.emit(ServerEvents.ERROR, error);
            return null;
        }
    }

    /**
     * Get the server URL
     */
    public getServerUrl(): string | null {
        if (this.serverInfo) {
            return `http://127.0.0.1:${this.serverInfo.port}`;
        }
        return null;
    }

    /**
     * Get the secret key
     */
    public getSecretKey(): string {
        return this.secretKey;
    }

    /**
     * Check if the server is ready to handle requests
     */
    public isReady(): boolean {
        return this.status === ServerStatus.RUNNING && this.apiClient !== null;
    }

    /**
     * Set the server status and emit an event
     */
    private setStatus(status: ServerStatus) {
        this.status = status;
        this.eventEmitter.emit(ServerEvents.STATUS_CHANGE, status);
        // Also emit a general event for extension to listen to
        this.extensionEvents.emit('statusChanged', status);
        console.log(`Server status changed to ${status}`);
    }

    /**
     * Add event listener for both ServerEvents and custom events
     */
    public on(event: ServerEvents | string, listener: (...args: any[]) => void): void {
        if (Object.values(ServerEvents).includes(event as ServerEvents)) {
            this.eventEmitter.on(event, listener);
        } else {
            this.extensionEvents.on(event, listener);
        }
    }

    /**
     * Unsubscribe from server events
     */
    public off(event: ServerEvents, listener: (...args: any[]) => void): void {
        this.eventEmitter.off(event, listener);
    }

    private getBinaryPath(): string {
        // Use the utility function to get the binary path
        return getBinaryPath(this.context, 'goosed');
    }

    private getWorkspaceDirectory(): string {
        // Implement the logic to get the workspace directory
        // This is a placeholder and should be replaced with the actual implementation
        return process.cwd();
    }
} 
