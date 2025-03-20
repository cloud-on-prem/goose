import { EventEmitter } from 'events';
import { Message } from '../types/messages';

export interface ApiClientConfig {
    baseUrl: string;
    secretKey: string;
    logger?: {
        info: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
    };
    debug?: boolean;
}

/**
 * A platform-agnostic client for communicating with the Goose API server
 */
export class ApiClient {
    private baseUrl: string;
    private secretKey: string;
    private logger: {
        info: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
    };
    private events: EventEmitter;
    private debug: boolean;

    constructor(config: ApiClientConfig) {
        this.baseUrl = config.baseUrl;
        this.secretKey = config.secretKey;
        this.events = new EventEmitter();
        this.debug = config.debug || false;
        this.logger = config.logger || {
            info: (message: string, ...args: any[]) => console.info(`[ApiClient] ${message}`, ...args),
            error: (message: string, ...args: any[]) => console.error(`[ApiClient] ${message}`, ...args),
        };
    }

    /**
     * Make a request to the Goose API
     * @param path The API endpoint path
     * @param options Fetch options
     * @returns The fetch response
     */
    public async request(path: string, options: RequestInit = {}): Promise<Response> {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'X-Secret-Key': this.secretKey,
        };

        try {
            this.logger.info(`Making API request to ${path}`);

            if (this.debug) {
                this.logger.info(`Request URL: ${url}`);
                this.logger.info(`Request headers: ${JSON.stringify(headers)}`);
                if (options.body) {
                    this.logger.info(`Request body: ${options.body}`);
                }
            }

            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (this.debug) {
                this.logger.info(`Response status: ${response.status} ${response.statusText}`);
                // Handle headers in a way that's compatible with all environments
                if (response.headers) {
                    const headerObj: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        headerObj[key] = value;
                    });
                    this.logger.info(`Response headers: ${JSON.stringify(headerObj)}`);
                }
            }

            if (!response.ok) {
                const error = await response.text();

                if (this.debug) {
                    this.logger.error(`Request failed with status ${response.status} ${response.statusText}`);
                    this.logger.error(`Error response: ${error}`);
                    this.logger.error(`Request URL: ${url}`);
                    this.logger.error(`Request method: ${options.method || 'GET'}`);
                    if (options.body) {
                        this.logger.error(`Request body: ${options.body}`);
                    }
                }

                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${error}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`API request to ${path} failed:`, error);
            throw error;
        }
    }

    /**
     * Stream a chat response from the API
     * @param messages The messages to send to the API
     * @param abortController Optional AbortController to cancel the request
     * @param sessionId Optional session ID
     * @param workingDir Optional working directory
     * @returns The response
     */
    public async streamChatResponse(
        messages: Message[],
        abortController?: AbortController,
        sessionId?: string,
        workingDir?: string
    ): Promise<Response> {
        // Always ensure we have a working directory
        const effectiveWorkingDir = workingDir || process.cwd();

        this.logger.info(`Streaming chat response with working dir: ${effectiveWorkingDir}`);

        const response = await this.request('/reply', {
            method: 'POST',
            body: JSON.stringify({
                messages,
                session_id: sessionId,
                session_working_dir: effectiveWorkingDir
            }),
            signal: abortController?.signal,
            headers: {
                'Accept': 'text/event-stream',
            },
        });

        return response;
    }

    /**
     * Simple ask method for quick responses
     * @param prompt The prompt to send
     * @param sessionId Optional session ID
     * @param workingDir Optional working directory
     * @returns The response text
     */
    public async ask(
        prompt: string,
        sessionId?: string,
        workingDir?: string
    ): Promise<string> {
        // Always ensure we have a working directory
        const effectiveWorkingDir = workingDir || process.cwd();

        this.logger.info(`Asking question with working dir: ${effectiveWorkingDir}`);

        const response = await this.request('/reply/ask', {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                session_id: sessionId,
                session_working_dir: effectiveWorkingDir
            }),
        });

        const data = await response.json();
        return data.text || '';
    }

    /**
     * Confirm a tool call
     * @param toolId The tool call ID
     * @param confirmed Whether the tool call is confirmed
     * @returns The response
     */
    public async confirmToolCall(toolId: string, confirmed: boolean): Promise<any> {
        const response = await this.request('/reply/confirm', {
            method: 'POST',
            body: JSON.stringify({
                id: toolId,
                confirmed
            }),
        });

        return await response.json();
    }

    /**
     * Get available agent versions
     * @returns Available versions and default version
     */
    public async getAgentVersions(): Promise<{ available_versions: string[], default_version: string }> {
        const response = await this.request('/agent/versions');
        return await response.json();
    }

    /**
     * Get available providers
     * @returns List of available providers
     */
    public async getProviders(): Promise<any[]> {
        const response = await this.request('/agent/providers');
        return await response.json();
    }

    /**
     * Create a new agent
     * @param provider The provider to use
     * @param model Optional model to use
     * @param version Optional agent version
     * @returns The created agent
     */
    public async createAgent(provider: string, model?: string, version?: string): Promise<any> {
        // Build request body with only defined values
        const requestBody: Record<string, string> = {
            provider
        };

        if (model) {
            requestBody.model = model;
        }

        if (version) {
            requestBody.version = version;
        }

        this.logger.info(`Creating agent with: provider=${provider}, model=${model || 'default'}, version=${version || 'default'}`);

        const response = await this.request('/agent', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });

        const responseData = await response.json();
        this.logger.info(`Agent created, response: ${JSON.stringify(responseData)}`);
        return responseData;
    }

    /**
     * Extend the agent prompt with a built-in extension
     * @param extensionName The name of the built-in extension to add
     * @returns Success status
     */
    public async addExtension(extensionName: string): Promise<any> {
        const response = await this.request('/extensions/add', {
            method: 'POST',
            body: JSON.stringify({
                type: 'builtin',
                name: extensionName
            }),
        });

        return await response.json();
    }

    /**
     * List available sessions
     * @returns List of sessions
     */
    public async listSessions(): Promise<any[]> {
        const response = await this.request('/sessions');
        return await response.json();
    }

    /**
     * Get session history
     * @param sessionId The session ID
     * @returns Session history
     */
    public async getSessionHistory(sessionId: string): Promise<any> {
        const response = await this.request(`/sessions/${sessionId}`);
        return await response.json();
    }

    /**
     * Check the server status
     * @returns True if the server is ready
     */
    public async checkStatus(): Promise<boolean> {
        try {
            const response = await this.request('/status');
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Add an event listener
     */
    public on(event: string, listener: (...args: any[]) => void): void {
        this.events.on(event, listener);
    }

    /**
     * Remove an event listener
     */
    public off(event: string, listener: (...args: any[]) => void): void {
        this.events.off(event, listener);
    }

    /**
     * Emit an event
     */
    public emit(event: string, ...args: any[]): boolean {
        return this.events.emit(event, ...args);
    }
} 
