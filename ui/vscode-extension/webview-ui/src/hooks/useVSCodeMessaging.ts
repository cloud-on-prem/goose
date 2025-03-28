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

        // Check server status before sending
        if (serverStatus === 'stopped') {
            const errorMessage: Message = {
                id: `error_${Date.now()}`,
                role: 'system',
                created: Date.now(),
                content: [{
                    type: 'text',
                    text: '❌ Cannot send message: Goose server is not connected. Please restart VS Code and try again.'
                }]
            };
            safeguardedSetMessages(prev => [...prev, errorMessage]);
            return;
        }

        // Log the session ID for debugging
        console.log('Sending message with sessionId:', sessionId);

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
            content: content as any, // Type assertion needed due to content structure
            sessionId: sessionId // Add sessionId to the message object for tracking
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
    }, [vscode, safeguardedSetMessages, serverStatus]);

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
                        // If this is a thinking message, update the intermediate text
                        if (message.message.content && Array.isArray(message.message.content)) {
                            const thinkingContent = message.message.content.find(
                                (item: any) => item.type === 'thinking' || item.type === 'redacted_thinking'
                            );

                            if (thinkingContent && 'thinking' in thinkingContent) {
                                setIntermediateText(thinkingContent.thinking);
                                return; // Don't add thinking messages to the main message list
                            }
                        }

                        // Get a content summary for comparison
                        const getContentSummary = (msg: any) => {
                            if (!msg.content || !Array.isArray(msg.content)) return '';
                            return msg.content.map((item: any) => {
                                if (item.type === 'text') return item.text || '';
                                if (item.type === 'toolRequest') return item.id || '';
                                return '';
                            }).join('|');
                        };

                        const newContentSummary = getContentSummary(message.message);

                        // Check if we have an existing message with the same ID
                        if (message.message.id && processedMessageIds.has(message.message.id)) {
                            // If content is actually different, update the existing message
                            const existingMsgIndex = messages.findIndex(m => m.id === message.message.id);

                            if (existingMsgIndex !== -1) {
                                const existingContentSummary = getContentSummary(messages[existingMsgIndex]);

                                // Only update if the content has changed
                                if (newContentSummary !== existingContentSummary) {
                                    console.log('Updating existing message with new content:', message.message.id);

                                    safeguardedSetMessages(prev => {
                                        const updated = [...prev];
                                        updated[existingMsgIndex] = message.message;
                                        return updated;
                                    });
                                } else {
                                    console.log('Content unchanged, skipping update');
                                }
                            }
                            return;
                        }

                        // Filter out empty text messages to prevent duplicate "Generating content..." messages
                        if (message.message.content && Array.isArray(message.message.content)) {
                            const hasEmptyTextOnly = message.message.content.every(
                                (item: any) => item.type === 'text' && (!item.text || item.text.trim() === '')
                            );

                            if (hasEmptyTextOnly && message.message.content.length > 0) {
                                console.log('Skipping empty text message');
                                return;
                            }
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
                case MessageType.AI_MESSAGE:
                    // Sometimes we receive partial content through AI_MESSAGE type
                    if (message.content && typeof message.content === 'string') {
                        // This is likely thinking/intermediate content
                        setIntermediateText(message.content);
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
                    // Update server status to stopped when we get fetch errors
                    if (message.errorMessage?.includes('fetch failed')) {
                        setServerStatus('stopped');

                        // Add error message to chat
                        const errorMessage: Message = {
                            id: `error_${Date.now()}`,
                            role: 'system',
                            created: Date.now(),
                            content: [{
                                type: 'text',
                                text: '❌ Failed to connect to Goose server. Please ensure the server is running and try again.'
                            }]
                        };
                        safeguardedSetMessages(prev => [...prev, errorMessage]);
                    }
                    setIsLoading(false);
                    break;
                case MessageType.ADD_CODE_REFERENCE:
                    if (message.codeReference) {
                        console.log('Adding code reference from selection:', message.codeReference);
                        setCodeReferences(prev => [...prev, message.codeReference]);
                    }
                    break;
                case MessageType.CODE_REFERENCE:
                    if (message.reference) {
                        setCodeReferences(prev => [...prev, message.reference]);
                    }
                    break;
                case MessageType.REMOVE_CODE_REFERENCE:
                    if (message.id) {
                        console.log('Removing code reference:', message.id);
                        setCodeReferences(prev => prev.filter(ref => ref.id !== message.id));
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

        // Set up a timer to periodically refresh the context and check server status
        const timer = setInterval(() => {
            getWorkspaceContext();
            // Check server status periodically
            vscode.postMessage({
                command: MessageType.GET_SERVER_STATUS
            });
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
