import { EventEmitter } from 'events';
import { TextDecoder } from 'util';
import { ServerManager } from '../serverManager';
import { Message, createUserMessage } from '../../shared/types';
import * as vscode from 'vscode';
import { SessionManager } from './sessionManager';

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
    private sessionManager: SessionManager | null = null;

    constructor(serverManager: ServerManager) {
        this.serverManager = serverManager;
        this.eventEmitter = new EventEmitter();
    }

    /**
     * Set the session manager
     */
    public setSessionManager(sessionManager: SessionManager): void {
        this.sessionManager = sessionManager;
    }

    /**
     * Send a message to the Goose AI
     */
    public async sendMessage(text: string, codeReferences?: any[], messageId?: string, sessionId?: string): Promise<void> {
        console.log("chatProcessor.sendMessage called with text:", text);

        // Get the session ID (from parameter or current session)
        let effectiveSessionId: string | undefined = sessionId;

        // Only try to get current session if no sessionId was provided
        if (!effectiveSessionId && this.sessionManager) {
            const currentSessionId = this.sessionManager.getCurrentSessionId();
            if (currentSessionId) {
                effectiveSessionId = currentSessionId;
            }
        }

        console.log("Using session ID:", effectiveSessionId || "none (creating new session)");

        // Format message with code references if provided
        let formattedText = text;
        if (codeReferences && codeReferences.length > 0) {
            formattedText = text || '';
            for (const reference of codeReferences) {
                if (formattedText.length > 0) {
                    formattedText += '\n\n';
                }
                formattedText += `From ${reference.filePath}:${reference.startLine}-${reference.endLine}`;
            }
        }

        console.log("Formatted message text:", formattedText);

        // Create a user message
        const userMessage: Message = {
            id: messageId || `user_${Date.now()}`,
            role: 'user',
            created: Date.now(),
            content: [{
                type: 'text',
                text: formattedText
            }]
        };

        // Add to current messages
        this.currentMessages.push(userMessage);
        console.log("Added user message to conversation, total messages:", this.currentMessages.length);

        // Reset stop flag
        this.shouldStop = false;

        try {
            // Send the message to the server
            console.log("Sending chat request to server...");
            const response = await this.sendChatRequest(effectiveSessionId);
            console.log("Got response from server, status:", response.status);

            // If this was a new session, load the session info after sending the first message
            if (!effectiveSessionId && this.sessionManager) {
                await this.sessionManager.fetchSessions();
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Create a unique ID for the AI message
            const aiMessageId = `ai_${Date.now()}`;
            console.log("Created AI message ID:", aiMessageId);

            // Initialize empty content
            let fullText = '';

            // Ensure the response body is available
            if (!response.body) {
                throw new Error('Response body is empty');
            }

            // Create a reader for the response
            const reader = response.body.getReader();
            console.log("Created reader for response body");

            // Create a new message object
            console.log("Creating initial AI message with current timestamp");
            const currentTimestamp = Date.now();
            const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                created: currentTimestamp, // Use the current time for consistency
                content: [{
                    type: 'text',
                    text: ''
                }]
            };

            // Add to current messages
            this.currentMessages.push(aiMessage);
            console.log("Added AI message placeholder to conversation, total messages:", this.currentMessages.length);

            // Read the streaming response
            console.log("Starting to read streaming response...");
            while (true) {
                // Check if we should stop
                if (this.shouldStop) {
                    console.log("Stopping generation (shouldStop flag is true)");
                    reader.cancel();
                    this.emit(ChatEvents.FINISH, aiMessage, 'stopped');
                    break;
                }

                console.log("Reading chunk from stream...");
                const { value, done } = await reader.read();

                if (done) {
                    console.log("Stream complete, emitting FINISH event");
                    this.emit(ChatEvents.FINISH, aiMessage, 'complete');
                    break;
                }

                // Convert the Uint8Array to a string
                const chunk = new TextDecoder().decode(value);
                console.log("Received chunk:", chunk);

                // Always update the content with whatever we have
                fullText += chunk;
                console.log("Updated fullText:", fullText);

                // Check if the content is a valid JSON string
                if (fullText.trim().startsWith('data:')) {
                    // Process the content
                    try {
                        // Extract the messages from the data: prefix
                        const lines = fullText.split('\n').filter(line => line.trim() !== '');

                        // Get the LAST message from the response
                        // This ensures we display the final message state
                        let lastMessageData = null;
                        let lastAssistantMessage = null;

                        // Process each line to find all messages
                        for (const line of lines) {
                            if (line.startsWith('data:')) {
                                try {
                                    const jsonStr = line.substring(5).trim();
                                    if (jsonStr === '[DONE]') { continue; }

                                    const data = JSON.parse(jsonStr);

                                    // Store the last message data we find
                                    lastMessageData = data;

                                    // If it's an assistant message, store it specifically
                                    if (data.type === 'Message' &&
                                        data.message &&
                                        data.message.role === 'assistant') {
                                        lastAssistantMessage = data.message;
                                    }
                                } catch (e) {
                                    console.error('Failed to parse JSON:', e);
                                }
                            }
                        }

                        // If we found an assistant message, use it directly
                        if (lastAssistantMessage) {
                            console.log("Using latest assistant message:", lastAssistantMessage);

                            // Update the message ID to match our expected ID pattern
                            lastAssistantMessage.id = aiMessage.id;

                            // IMPORTANT: Always use the CURRENT timestamp for consistency
                            // This ensures timestamps reflect when messages were actually received
                            lastAssistantMessage.created = Date.now();

                            // Send the extracted message directly
                            this.emit(ChatEvents.MESSAGE_RECEIVED, lastAssistantMessage);
                        }
                        // Otherwise, use any message data we found
                        else if (lastMessageData) {
                            console.log("Using latest message data:", lastMessageData);

                            // Try to extract message content
                            let messageText = '';

                            if (lastMessageData.message &&
                                lastMessageData.message.content &&
                                Array.isArray(lastMessageData.message.content) &&
                                lastMessageData.message.content[0] &&
                                lastMessageData.message.content[0].text) {
                                messageText = lastMessageData.message.content[0].text;
                            } else if (typeof lastMessageData.message === 'string') {
                                messageText = lastMessageData.message;
                            }

                            if (messageText) {
                                console.log("Extracted message text from latest data:", messageText);
                                const updatedMessage = { ...aiMessage };
                                updatedMessage.created = Date.now(); // Use current timestamp
                                updatedMessage.content = [{
                                    type: 'text',
                                    text: messageText
                                }];

                                // Send the updated message
                                this.emit(ChatEvents.MESSAGE_RECEIVED, updatedMessage);
                            } else {
                                // Last resort: use the raw JSON data
                                const updatedMessage = { ...aiMessage };
                                updatedMessage.created = Date.now(); // Use current timestamp
                                updatedMessage.content = [{
                                    type: 'text',
                                    text: JSON.stringify(lastMessageData, null, 2)
                                }];

                                this.emit(ChatEvents.MESSAGE_RECEIVED, updatedMessage);
                            }
                        } else {
                            // Extreme fallback - use raw text
                            console.log("No valid messages found, using raw text");
                            const updatedMessage = { ...aiMessage };
                            updatedMessage.created = Date.now(); // Use current timestamp
                            updatedMessage.content = [{
                                type: 'text',
                                text: fullText
                            }];

                            // Send the raw text as a message
                            this.emit(ChatEvents.MESSAGE_RECEIVED, updatedMessage);
                        }
                    } catch (e) {
                        console.error('Error processing chunk:', e);

                        // As a fallback, just use the raw text
                        const updatedMessage = { ...aiMessage };
                        updatedMessage.content = [{
                            type: 'text',
                            text: fullText
                        }];

                        // Send the raw text as a message
                        this.emit(ChatEvents.MESSAGE_RECEIVED, updatedMessage);
                    }
                } else {
                    // If it's not JSON, just use it as raw text
                    const updatedMessage = { ...aiMessage };
                    updatedMessage.created = Date.now(); // Use current timestamp
                    updatedMessage.content = [{
                        type: 'text',
                        text: fullText
                    }];

                    // Send the updated message
                    this.emit(ChatEvents.MESSAGE_RECEIVED, updatedMessage);
                }
            }
        } catch (error) {
            this.shouldStop = true;
            this.emit(ChatEvents.ERROR, error);
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Stop the current generation
     */
    public stopGeneration(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.shouldStop = false;

        // If there's an active message being generated, finish it with current timestamp
        if (this.currentMessages.length > 0) {
            const lastMessage = this.currentMessages[this.currentMessages.length - 1];
            if (lastMessage.role === 'assistant') {
                // Update the timestamp to the current time
                lastMessage.created = Date.now();
            }
        }

        this.emit(ChatEvents.FINISH, null, 'aborted');
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

    /**
     * Send a chat request to the server
     */
    private async sendChatRequest(sessionId?: string): Promise<Response> {
        console.log("Creating new AbortController for chat request");
        this.abortController = new AbortController();

        // Get workspace directory to use as working directory
        const workspaceDirectory = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        // Get API client from server manager
        const apiClient = this.serverManager.getApiClient();
        if (!apiClient) {
            throw new Error('API client not available');
        }

        return await apiClient.streamChatResponse(
            this.currentMessages,
            this.abortController,
            sessionId,
            workspaceDirectory
        );
    }

    private emit(event: ChatEvents, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    // Add this helper function to ensure text content is properly formatted
    private ensureValidTextContent(text: any): string {
        // If it's already a string
        if (typeof text === 'string') {
            return text;
        }

        // If it's an object with a text property
        if (text && typeof text === 'object') {
            // Check for common message formats
            if (typeof text.text === 'string') {
                return text.text;
            }

            if (typeof text.content === 'string') {
                return text.content;
            }

            // Sometimes the content is an array of parts
            if (Array.isArray(text.content)) {
                const combinedContent = text.content
                    .map((part: any) => {
                        if (typeof part === 'string') { return part; }
                        if (part && typeof part.text === 'string') { return part.text; }
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n\n');

                if (combinedContent) {
                    return combinedContent;
                }
            }

            // If the object has a 'message' property
            if (typeof text.message === 'string') {
                return text.message;
            }

            // Try to stringify the object if all else fails
            try {
                const jsonString = JSON.stringify(text);
                if (jsonString !== '{}' && jsonString !== '[]') {
                    return jsonString;
                }
            } catch (e) {
                console.error('Failed to stringify object:', e);
            }
        }

        // If it's some other type, try to convert it to string
        if (text !== undefined && text !== null) {
            try {
                return String(text);
            } catch (e) {
                console.error("Could not convert message content to string:", e);
            }
        }

        // Fallback for empty/invalid content
        return "";
    }

    /**
     * Process and handle the AI's message
     */
    private handleAIMessage(content: any, messageId: string): Message {
        // Create a fresh message object with a unique ID if we don't have one
        const aiMessage: Message = {
            id: messageId || `ai_${Date.now()}`,
            role: 'assistant',
            created: Date.now(),
            content: []
        };

        // Process the content
        const textContent = this.ensureValidTextContent(content);

        // Add the text as content
        if (textContent) {
            aiMessage.content.push({
                type: 'text',
                text: textContent
            });
        }

        // Don't emit the message event here - only in the main function
        return aiMessage;
    }
}

