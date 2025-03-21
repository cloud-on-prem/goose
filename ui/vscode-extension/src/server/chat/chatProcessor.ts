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
     * @param codeReferences Optional code references to include with the message
     * @param messageId Optional message ID for tracking
     */
    public async sendMessage(text: string, codeReferences?: any[], messageId?: string): Promise<void> {
        if (!this.serverManager.isReady()) {
            throw new Error('Server is not ready');
        }

        // Generate a consistent message ID
        const msgId = messageId || `user_${Date.now()}`;
        console.log(`Processing message with ID: ${msgId}`);

        // Create formatted text for API request
        let formattedText = text.trim();

        // Only add the double newlines if there's actual text content
        if (formattedText && codeReferences && codeReferences.length > 0) {
            formattedText += '\n\n';
        }

        // Add code references to the message if provided
        if (codeReferences && codeReferences.length > 0) {
            for (const reference of codeReferences) {
                formattedText += `From ${reference.fileName}:${reference.startLine}-${reference.endLine}:\n\n`;
                formattedText += `\`\`\`${reference.languageId}\n${reference.selectedText}\n\`\`\`\n\n`;
            }
        }

        // Create user message with the same ID that will be used in the UI
        const userMessage: Message = {
            role: 'user',
            content: [{ type: 'text', text: formattedText }],
            id: msgId,
            created: Date.now()
        };

        console.log(`Adding user message with ID ${msgId} to conversation`);
        this.currentMessages = [...this.currentMessages, userMessage];
        console.log(`Current conversation has ${this.currentMessages.length} messages`);

        try {
            this.shouldStop = false;
            console.log('Sending chat request to server');
            const response = await this.sendChatRequest();

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            this.shouldStop = true;
            // Initialize with a unique assistant message ID that is related to the user message
            let assistantMsgId = `ai_${msgId.replace('user_', '')}_${Date.now()}`;
            console.log(`Generated initial assistant message ID: ${assistantMsgId}`);

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    this.shouldStop = false;
                    this.emit(ChatEvents.FINISH,
                        { id: assistantMsgId },
                        'complete'
                    );
                    break;
                }

                try {
                    const chunk = new TextDecoder().decode(value);

                    // Log the raw chunk for debugging
                    console.log(`Raw chunk received:`, chunk);

                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        try {
                            if (line.startsWith('data:')) {
                                const jsonStr = line.slice(5).trim();
                                if (jsonStr === '[DONE]') {
                                    continue;
                                }

                                // Log the parsed JSON string
                                console.log(`Parsed JSON string:`, jsonStr);

                                const data = JSON.parse(jsonStr);

                                // Log the full data object to inspect its structure
                                console.log(`Parsed data object:`, data);

                                // Ensure we have valid text content
                                // Check if data.message exists and what format it has
                                console.log(`Message format:`, typeof data.message, data.message);

                                const messageText = this.ensureValidTextContent(data.message);

                                // Log the extracted message text
                                console.log(`Extracted message text:`, messageText);

                                // Only create and emit a message if we have actual content
                                if (messageText.trim()) {
                                    // Create a properly formatted message
                                    const chunkMessage: Message = {
                                        id: assistantMsgId,
                                        role: 'assistant',
                                        created: Date.now(),
                                        content: [{
                                            type: 'text',
                                            text: messageText
                                        }]
                                    };

                                    console.log(`Emitting message with ID: ${assistantMsgId} and content length: ${messageText.length}`);
                                    this.emit(ChatEvents.MESSAGE_RECEIVED, chunkMessage);

                                    // Update the internal messages state to include the latest chunk
                                    // First check if we already have a message with this ID
                                    const existingMsgIndex = this.currentMessages.findIndex(msg => msg.id === assistantMsgId);
                                    if (existingMsgIndex >= 0) {
                                        // Update existing message
                                        this.currentMessages[existingMsgIndex] = chunkMessage;
                                    } else {
                                        // Add new message
                                        this.currentMessages = [...this.currentMessages, chunkMessage];
                                    }
                                    console.log(`Current conversation has ${this.currentMessages.length} messages`);
                                } else {
                                    console.log(`Skipping empty message content`);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing message chunk:', e);
                        }
                    }
                } catch (e) {
                    console.error('Error processing response chunk:', e);
                }
            }
        } catch (error) {
            this.shouldStop = false;
            this.emit(ChatEvents.ERROR, error);
            throw error;
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

    private async sendChatRequest(): Promise<Response> {
        this.abortController = new AbortController();

        if (!this.serverManager.isReady()) {
            throw new Error('Server is not ready');
        }

        const apiClient = this.serverManager.getApiClient();
        if (!apiClient) {
            throw new Error('API client is not available');
        }

        let workingDir = process.cwd();

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workingDir = workspaceFolders[0].uri.fsPath;
        }

        return await apiClient.streamChatResponse(
            this.currentMessages,
            this.abortController,
            undefined,
            workingDir
        );
    }

    private emit(event: ChatEvents, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    // Add this helper function to ensure text content is properly formatted
    private ensureValidTextContent(text: any): string {
        console.log('Ensuring valid text content for:', text);

        // If it's already a string
        if (typeof text === 'string') {
            console.log('Text is already a string');
            return text;
        }

        // If it's an object with a text property
        if (text && typeof text === 'object') {
            console.log('Text is an object');

            // Check for common message formats
            if (typeof text.text === 'string') {
                console.log('Found text.text property');
                return text.text;
            }

            if (typeof text.content === 'string') {
                console.log('Found text.content property');
                return text.content;
            }

            // Sometimes the content is an array of parts
            if (Array.isArray(text.content)) {
                console.log('Found text.content array');
                const combinedContent = text.content
                    .map((part: any) => {
                        if (typeof part === 'string') return part;
                        if (part && typeof part.text === 'string') return part.text;
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n\n');

                if (combinedContent) {
                    console.log('Extracted content from array');
                    return combinedContent;
                }
            }

            // If the object has a 'message' property
            if (typeof text.message === 'string') {
                console.log('Found text.message property');
                return text.message;
            }

            // Try to stringify the object if all else fails
            try {
                console.log('Trying to JSON stringify the object');
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
                console.log('Converting non-string/object to string');
                return String(text);
            } catch (e) {
                console.error("Could not convert message content to string:", e);
            }
        }

        console.log('All extraction attempts failed, returning empty string');
        // Fallback for empty/invalid content
        return "";
    }
} 
