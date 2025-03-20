import { EventEmitter } from 'events';
import { TextDecoder } from 'util';
import { ServerManager } from '../serverManager';
import { Message, createUserMessage } from '../../shared/types';
import * as vscode from 'vscode';

/**
 * Events emitted by the chat processor
 */
export enum ChatEvents {
    MESSAGE_RECEIVED = 'messageReceived',
    FINISH = 'finish',
    ERROR = 'error'
}

/**
 * Event types for SSE stream
 */
type MessageEvent =
    | { type: 'Message'; message: Message }
    | { type: 'Error'; error: string }
    | { type: 'Finish'; reason: string };

/**
 * Handles communication with the Goose server for chat functionality
 */
export class ChatProcessor {
    private serverManager: ServerManager;
    private eventEmitter: EventEmitter;
    private abortController: AbortController | null = null;
    private currentMessages: Message[] = [];
    private shouldStop: boolean = false;

    constructor(serverManager: ServerManager) {
        this.serverManager = serverManager;
        this.eventEmitter = new EventEmitter();
    }

    /**
     * Send a message to the Goose server
     * @param text The text to send
     */
    public async sendMessage(text: string): Promise<void> {
        if (!this.serverManager.isReady()) {
            throw new Error('Server is not ready');
        }

        // Create a user message and emit it
        const userMessage = createUserMessage(text);

        // Emit the message event so UI can update immediately
        this.emit(ChatEvents.MESSAGE_RECEIVED, userMessage);

        // Add the message to our current messages
        this.currentMessages = [...this.currentMessages, userMessage];
        console.log(`Added user message to conversation. Current count: ${this.currentMessages.length}`);

        try {
            // Reset for new completion
            this.shouldStop = false;

            // Set up the fetch request for SSE
            const response = await this.sendChatRequest();

            // Process the message stream
            await this.processMessageStream(response);

        } catch (error) {
            console.error('Error in chat completion:', error);
            this.emit(ChatEvents.ERROR, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Stop the current AI generation if any is in progress
     */
    public stop(): void {
        this.shouldStop = true;

        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Process the SSE stream from the server
     */
    private async processMessageStream(response: Response): Promise<void> {
        if (!response.body) {
            throw new Error('Response body is empty');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            let running = true;
            while (running) {
                const { done, value } = await reader.read();
                if (done) {
                    running = false;
                    break;
                }

                // Decode the chunk and add it to our buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events
                const events = buffer.split('\n\n');
                buffer = events.pop() || ''; // Keep the last incomplete event in the buffer

                for (const event of events) {
                    if (event.startsWith('data: ')) {
                        try {
                            const data = event.slice(6); // Remove 'data: ' prefix
                            const parsedEvent = JSON.parse(data) as MessageEvent;

                            switch (parsedEvent.type) {
                                case 'Message':
                                    console.log(`Received message from server: role=${parsedEvent.message.role}`);

                                    // Create a new assistant message with a unique ID
                                    const assistantMessage: Message = {
                                        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        role: 'assistant',
                                        created: Math.floor(Date.now() / 1000),
                                        content: parsedEvent.message.content
                                    };

                                    console.log(`Created new assistant message with id: ${assistantMessage.id}`);

                                    // Add to conversation history
                                    this.currentMessages = [...this.currentMessages, assistantMessage];
                                    console.log(`Current conversation has ${this.currentMessages.length} messages`);

                                    // Emit the message event so UI can update
                                    this.eventEmitter.emit(ChatEvents.MESSAGE_RECEIVED, assistantMessage);
                                    break;

                                case 'Error':
                                    throw new Error(parsedEvent.error);

                                case 'Finish':
                                    // Call onFinish with the last message if available
                                    if (this.currentMessages.length > 0) {
                                        const lastMessage = this.currentMessages[this.currentMessages.length - 1];
                                        this.eventEmitter.emit(ChatEvents.FINISH, lastMessage, parsedEvent.reason);
                                    }
                                    break;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE event:', e);
                            this.eventEmitter.emit(ChatEvents.ERROR, e);
                        }
                    }
                }
            }
        } catch (e) {
            if (e instanceof Error && e.name !== 'AbortError') {
                console.error('Error reading SSE stream:', e);
                this.eventEmitter.emit(ChatEvents.ERROR, e);
            }
        }
    }

    /**
     * Get all current messages
     */
    public getMessages(): Message[] {
        return this.currentMessages;
    }

    /**
     * Clear all messages
     */
    public clearMessages(): void {
        this.currentMessages = [];
    }

    /**
     * Subscribe to chat events
     */
    public on(event: ChatEvents, listener: (...args: any[]) => void): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Unsubscribe from chat events
     */
    public off(event: ChatEvents, listener: (...args: any[]) => void): void {
        this.eventEmitter.off(event, listener);
    }

    private async sendChatRequest(): Promise<Response> {
        // Create abort controller for cancellation
        this.abortController = new AbortController();

        if (!this.serverManager.isReady()) {
            throw new Error('Server is not ready');
        }

        const apiClient = this.serverManager.getApiClient();
        if (!apiClient) {
            throw new Error('API client is not available');
        }

        // Get the current workspace directory
        let workingDir = process.cwd();

        // If VSCode has an active workspace folder, use that instead
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workingDir = workspaceFolders[0].uri.fsPath;
        }

        // Use the API client to make the request with proper authentication
        return await apiClient.streamChatResponse(
            this.currentMessages,
            this.abortController,
            undefined, // No session ID for now
            workingDir
        );
    }

    private emit(event: ChatEvents, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }
} 
