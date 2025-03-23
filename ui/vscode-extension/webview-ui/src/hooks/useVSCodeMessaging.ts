import { useState, useEffect, useCallback } from 'react';
import { getVSCodeAPI } from '../utils/vscode';
import {
    Message,
    MessageType,
    CodeReference,
    WorkspaceContext
} from '../types';

// Unused type, renamed with underscore prefix
type _MessageHandler = (message: any) => void;

interface UseVSCodeMessagingResult {
    messages: Message[];
    serverStatus: string;
    isLoading: boolean;
    intermediateText: string | null;
    currentMessageId: string | null;
    codeReferences: CodeReference[];
    workspaceContext: WorkspaceContext | null;
    sendChatMessage: (text: string, refs: CodeReference[], sessionId: string | null) => void;
    stopGeneration: () => void;
    getWorkspaceContext: () => void;
}

export const useVSCodeMessaging = (): UseVSCodeMessagingResult => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [serverStatus, setServerStatus] = useState<string>('stopped');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
    const [intermediateText, setIntermediateText] = useState<string | null>(null);
    const [codeReferences, setCodeReferences] = useState<CodeReference[]>([]);
    const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);
    const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set());

    const vscode = getVSCodeAPI();

    // Safely update messages state with error handling
    const safeguardedSetMessages = useCallback((updater: React.SetStateAction<Message[]>) => {
        try {
            setMessages(updater);
        } catch (err) {
            console.error('Error updating messages:', err);
        }
    }, []);

    // Send a hello message to the extension
    const sendHelloMessage = useCallback(() => {
        vscode.postMessage({
            command: MessageType.HELLO,
            text: 'Hello from the webview!'
        });
    }, [vscode]);

    // Send a chat message
    const sendChatMessage = useCallback((
        text: string,
        refs: CodeReference[],
        sessionId: string | null
    ) => {
        if (!text.trim() && refs.length === 0) {
            return;
        }

        // Create a unique ID for this message
        const messageId = `user_${Date.now()}`;

        // Format code references for display in the UI
        const content = [];

        // Add the text content if it's not empty
        if (text.trim()) {
            content.push({
                type: 'text',
                text: text
            });
        }

        // Add code references as separate content items
        if (refs.length > 0) {
            for (const ref of refs) {
                content.push({
                    type: 'text',
                    text: `From ${ref.fileName}:${ref.startLine}-${ref.endLine}`
                });
            }
        }

        // Create a user message object with all content
        const userMessage: Message = {
            id: messageId,
            role: 'user',
            created: Date.now(),
            content: content as any // Type assertion needed due to content structure
        };

        // Update messages state with the new message
        safeguardedSetMessages(prevMessages => [...prevMessages, userMessage]);

        // Add the ID to processed set to prevent duplicates if we get it back from the extension
        setProcessedMessageIds(prev => new Set(prev).add(messageId));

        // Send message to extension
        vscode.postMessage({
            command: MessageType.SEND_CHAT_MESSAGE,
            text: text,
            codeReferences: refs,
            messageId: messageId,
            sessionId: sessionId
        });

        setIsLoading(true);
        setCurrentMessageId(messageId);
        setIntermediateText(null); // Clear any previous intermediate text
    }, [vscode, safeguardedSetMessages]);

    // Stop AI generation
    const stopGeneration = useCallback(() => {
        vscode.postMessage({
            command: MessageType.STOP_GENERATION
        });
        setIsLoading(false);
    }, [vscode]);

    // Request workspace context
    const getWorkspaceContext = useCallback(() => {
        vscode.postMessage({
            command: MessageType.GET_WORKSPACE_CONTEXT
        });
    }, [vscode]);

    // Set up event listener for VS Code extension messages
    useEffect(() => {
        // Initial setup
        sendHelloMessage();
        getWorkspaceContext();

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message || !message.command) return;

            console.log('Received message from extension:', message.command);

            switch (message.command) {
                case MessageType.CHAT_RESPONSE:
                    if (message.message) {
                        // Skip if this message has already been processed to avoid duplicates
                        if (message.message.id && processedMessageIds.has(message.message.id)) {
                            console.log('Skipping duplicate message:', message.message.id);
                            return;
                        }

                        // Add the message ID to processed set
                        if (message.message.id) {
                            setProcessedMessageIds(prev => {
                                const newSet = new Set(prev);
                                newSet.add(message.message.id);
                                return newSet;
                            });
                        }

                        // Now add the message to the state
                        safeguardedSetMessages(prev => [...prev, message.message]);
                    }
                    break;
                case MessageType.SERVER_STATUS:
                    if (message.status) {
                        setServerStatus(message.status);
                    }
                    break;
                case MessageType.GENERATION_FINISHED:
                    setIsLoading(false);
                    setIntermediateText(null);
                    break;
                case MessageType.WORKSPACE_CONTEXT:
                    if (message.context) {
                        setWorkspaceContext(message.context);
                    }
                    break;
                case MessageType.ERROR:
                    console.error('Error from extension:', message.errorMessage);
                    // Optionally show an error notification or add an error message to chat
                    setIsLoading(false);
                    break;
                case MessageType.CODE_REFERENCE:
                    if (message.reference) {
                        setCodeReferences(prev => [...prev, message.reference]);
                    }
                    break;
                case MessageType.SESSION_LOADED:
                case 'sessionLoaded':
                    console.log('Session loaded with ID:', message.sessionId);

                    // Reset all state for the new session
                    setCodeReferences([]);
                    setCurrentMessageId(null);
                    setIntermediateText(null);
                    setIsLoading(false);

                    // Simple approach - just clear messages first
                    setMessages([]);

                    // Check if we have messages to display
                    if (!message.messages || !Array.isArray(message.messages) || message.messages.length === 0) {
                        console.log('No messages in session');
                        break;
                    }

                    // We'll defer loading the messages to prevent React errors
                    setTimeout(() => {
                        try {
                            // Very basic message transformation - just ensure required fields exist
                            const validMessages = message.messages
                                .filter(msg => msg && typeof msg === 'object')
                                .map(msg => ({
                                    id: msg.id || `msg_${Math.random().toString(36).substr(2, 9)}`,
                                    role: msg.role || 'unknown',
                                    created: msg.created || Date.now(),
                                    content: Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: 'Message content unavailable' }]
                                }));

                            console.log(`Loading ${validMessages.length} messages`);
                            setMessages(validMessages);
                        } catch (err) {
                            console.error('Error processing messages:', err);
                        }
                    }, 100); // Slight delay to ensure React has time to process state changes
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // Set up a timer to periodically refresh the context
        const timer = setInterval(() => {
            getWorkspaceContext();
        }, 30000); // Every 30 seconds

        // Clean up event listener and timer
        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(timer);
        };
    }, [
        sendHelloMessage,
        getWorkspaceContext,
        processedMessageIds,
        safeguardedSetMessages
    ]);

    return {
        messages,
        serverStatus,
        isLoading,
        intermediateText,
        currentMessageId,
        codeReferences,
        workspaceContext,
        sendChatMessage,
        stopGeneration,
        getWorkspaceContext
    };
}; 
