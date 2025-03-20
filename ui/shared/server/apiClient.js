"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const events_1 = require("events");
/**
 * A platform-agnostic client for communicating with the Goose API server
 */
class ApiClient {
    baseUrl;
    secretKey;
    logger;
    events;
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.secretKey = config.secretKey;
        this.events = new events_1.EventEmitter();
        this.logger = config.logger || {
            info: (message, ...args) => console.info(`[ApiClient] ${message}`, ...args),
            error: (message, ...args) => console.error(`[ApiClient] ${message}`, ...args),
        };
    }
    /**
     * Make a request to the Goose API
     * @param path The API endpoint path
     * @param options Fetch options
     * @returns The fetch response
     */
    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.secretKey}`,
        };
        try {
            this.logger.info(`Making API request to ${path}`);
            const response = await fetch(url, {
                ...options,
                headers,
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${error}`);
            }
            return response;
        }
        catch (error) {
            this.logger.error(`API request to ${path} failed:`, error);
            throw error;
        }
    }
    /**
     * Stream a chat response from the API
     * @param messages The messages to send to the API
     * @param abortController Optional AbortController to cancel the request
     * @returns The response
     */
    async streamChatResponse(messages, abortController) {
        const response = await this.request('/api/chat/reply', {
            method: 'POST',
            body: JSON.stringify({ messages }),
            signal: abortController?.signal,
            headers: {
                'Accept': 'text/event-stream',
            },
        });
        return response;
    }
    /**
     * Check the server status
     * @returns True if the server is ready
     */
    async checkStatus() {
        try {
            const response = await this.request('/status');
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Add an event listener
     */
    on(event, listener) {
        this.events.on(event, listener);
    }
    /**
     * Remove an event listener
     */
    off(event, listener) {
        this.events.off(event, listener);
    }
    /**
     * Emit an event
     */
    emit(event, ...args) {
        return this.events.emit(event, ...args);
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=apiClient.js.map