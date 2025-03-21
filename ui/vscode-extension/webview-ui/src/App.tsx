import React, { useEffect, useState, useRef } from 'react';
import './vscodeStyles.css'; // Import VS Code theme variables
// Import React Markdown for rendering markdown content
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Import syntax highlighter for code blocks
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import the VSCode API for communicating with the extension
import { vscode } from './vscode';
// Import types
import { MessageType } from '../../src/shared/messageTypes';
import { Message } from '../../src/shared/types';
// Import new components
import { Header } from './components/Header';
import { SessionList, SessionMetadata } from './components/SessionList';

// VS Code API is available as a global when running in a webview
declare global {
    interface Window {
        acquireVsCodeApi: () => {
            postMessage: (message: any) => void;
            getState: () => any;
            setState: (state: any) => void;
        };
    }
}

// Types
interface CodeReference {
    id: string;
    filePath: string;
    fileName: string;
    startLine: number;
    endLine: number;
    selectedText: string;
    languageId: string;
}

// Add WorkspaceContext type
interface WorkspaceContext {
    currentLanguage?: string;
    projectType?: string;
    currentFile?: string;
    currentFilePath?: string;
    diagnostics?: any[];
    recentFiles?: string[];
    openFiles?: string[];
}

// Message types for communication with the extension
enum MessageType {
    HELLO = 'hello',
    GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
    ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
    ERROR = 'error',
    SERVER_STATUS = 'serverStatus',
    CHAT_MESSAGE = 'chatMessage',
    SEND_CHAT_MESSAGE = 'sendChatMessage',
    AI_MESSAGE = 'aiMessage',
    STOP_GENERATION = 'stopGeneration',
    GENERATION_FINISHED = 'generationFinished',
    CODE_REFERENCE = 'codeReference',
    ADD_CODE_REFERENCE = 'addCodeReference',
    REMOVE_CODE_REFERENCE = 'removeCodeReference',
    GET_WORKSPACE_CONTEXT = 'getWorkspaceContext',
    WORKSPACE_CONTEXT = 'workspaceContext',
    CHAT_RESPONSE = 'chatResponse',
    SESSIONS_LIST = 'sessionsList',
    SESSION_LOADED = 'sessionLoaded',
    SWITCH_SESSION = 'switchSession',
    CREATE_SESSION = 'createSession',
    RENAME_SESSION = 'renameSession',
    DELETE_SESSION = 'deleteSession',
    GET_SESSIONS = 'getSessions'
}

// Acquire VS Code API
const vscode = window.acquireVsCodeApi();

const App: React.FC = () => {
    const [editorContent, setEditorContent] = useState<string | null>(null);
    const [editorFile, setEditorFile] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [serverStatus, setServerStatus] = useState<string>('stopped');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState<boolean>(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [codeReferences, setCodeReferences] = useState<CodeReference[]>([]);
    const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);
    const [showContextInfo, setShowContextInfo] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set());
    const [intermediateText, setIntermediateText] = useState<string | null>(null);

    // New state for session management
    const [sessions, setSessions] = useState<SessionMetadata[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showSessionDrawer, setShowSessionDrawer] = useState<boolean>(false);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        // Initial setup
        sendHelloMessage();
        fetchSessions(); // Fetch sessions on initial load

        // Set up message event listener
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Received message from extension:', message);

            // Ignore messages without a command
            if (!message || !message.command) {
                return;
            }

            switch (message.command) {
                case MessageType.HELLO:
                    // Extension acknowledged our presence
                    break;
                case MessageType.ACTIVE_EDITOR_CONTENT:
                    // Received active editor content
                    break;
                case MessageType.SERVER_STATUS:
                    console.log('Received server status:', message.status);
                    setServerStatus(message.status);
                    break;
                case MessageType.CHAT_RESPONSE:
                    // Only process if the message has an actual message object
                    if (!message.message) {
                        console.error('Received CHAT_RESPONSE without message object');
                        return;
                    }

                    console.log('Processing CHAT_RESPONSE:', message.message);
                    // Check for duplicate messages by ID (especially important for streaming)
                    const messageId = message.message.id;

                    // Make sure the message has valid content
                    if (!message.message.content) {
                        message.message.content = [{ type: 'text', text: '' }];
                    }

                    // Get the text content from the message for intermediate display
                    const textContent = message.message.content.find(item =>
                        item.type === 'text' && item.text)?.text || '';

                    // If we're generating and this is from the current message ID, store it as intermediate text
                    if (isLoading && currentMessageId && messageId === currentMessageId) {
                        // Set the intermediate text for display in the generating indicator
                        setIntermediateText(textContent);
                        return; // Don't add to messages array yet
                    } else if (isLoading && !currentMessageId) {
                        // This is likely a stray update from a previous generation
                        // Store it as intermediateText anyway
                        setIntermediateText(textContent);
                        return;
                    }

                    // Don't skip empty assistant messages during generation
                    // Only skip empty messages after generation is complete
                    const isInProgress = isLoading && currentMessageId !== null;
                    const hasContent = message.message.content.some(item =>
                        item.type === 'text' && item.text && item.text.trim() !== '');

                    if (!hasContent && message.message.role === 'assistant' && !isInProgress) {
                        console.log('Skipping empty assistant message');
                        return;
                    }

                    setMessages(prevMessages => {
                        // Debug logging
                        console.log('Current messages:', prevMessages.length);

                        let updatedMessages;

                        // Check if this message already exists in our state (by ID)
                        const existingIndex = prevMessages.findIndex(m => m.id === messageId);

                        if (existingIndex !== -1) {
                            // Update existing message
                            const updatedMessagesArray = [...prevMessages];
                            updatedMessagesArray[existingIndex] = message.message;
                            updatedMessages = updatedMessagesArray;
                            console.log('Updated existing message at index', existingIndex);
                        } else {
                            // Append the new message
                            updatedMessages = [...prevMessages, message.message];
                            console.log('Added new message, total count:', updatedMessages.length);
                        }

                        return updatedMessages;
                    });
                    break;
                case MessageType.GENERATION_FINISHED:
                    console.log('Received GENERATION_FINISHED event');

                    // If there's intermediate text, add it as the final message
                    if (intermediateText && currentMessageId) {
                        const finalMessage: Message = {
                            id: currentMessageId,
                            role: 'assistant',
                            created: Date.now(),
                            content: [{
                                type: 'text',
                                text: intermediateText
                            }]
                        };

                        setMessages(prevMessages => {
                            // Check if this message already exists in our state
                            const existingIndex = prevMessages.findIndex(m => m.id === currentMessageId);

                            if (existingIndex !== -1) {
                                // Update existing message
                                const updatedMessagesArray = [...prevMessages];
                                updatedMessagesArray[existingIndex] = finalMessage;
                                return updatedMessagesArray;
                            } else {
                                // Append the new message
                                return [...prevMessages, finalMessage];
                            }
                        });
                    }

                    setIsLoading(false);
                    setCurrentMessageId(null);
                    setIntermediateText(null); // Clear the intermediate text
                    break;
                case MessageType.ADD_CODE_REFERENCE:
                    // Add a code reference to the UI
                    if (message.codeReference) {
                        setCodeReferences(prev => [
                            ...prev,
                            message.codeReference
                        ]);
                    }
                    break;
                case MessageType.CHAT_MESSAGE:
                    // Pre-populate input with a message
                    if (message.text) {
                        setInputMessage(message.text);
                    }
                    break;
                case MessageType.WORKSPACE_CONTEXT:
                    if (message.context) {
                        setWorkspaceContext(message.context);
                    }
                    break;
                case MessageType.SESSIONS_LIST:
                    // Handle sessions list
                    if (message.sessions) {
                        console.log('Received sessions list:', message.sessions);
                        // Ensure we're setting an array and validate session data structure
                        const validSessions = Array.isArray(message.sessions)
                            ? message.sessions.filter(session =>
                                session &&
                                typeof session === 'object' &&
                                session.id &&
                                session.metadata &&
                                typeof session.metadata === 'object')
                            : [];

                        console.log('Valid sessions after filtering:', validSessions.length);
                        setSessions(validSessions);
                    }
                    break;
                case MessageType.SESSION_LOADED:
                    // Handle session loaded event
                    if (message.sessionId) {
                        console.log('Loaded session:', message.sessionId);
                        setCurrentSessionId(message.sessionId);

                        // If messages are provided, replace the current messages with them
                        if (message.messages && Array.isArray(message.messages)) {
                            console.log('Setting messages from loaded session');
                            setMessages(message.messages);
                        }
                    }
                    break;
                case MessageType.SEND_CHAT_MESSAGE:
                    // No need for duplicate detection here - we'll use the messageId system
                    break;
                default:
                    // Unhandled message type
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // Clean up event listener
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Send a hello message to the extension
    const sendHelloMessage = () => {
        vscode.postMessage({
            command: MessageType.HELLO,
            text: 'Hello from the webview!'
        });
    };

    // Request active editor content
    const getActiveEditorContent = () => {
        vscode.postMessage({
            command: MessageType.GET_ACTIVE_EDITOR_CONTENT
        });
    };

    // Add a wrapper function for setMessages at the beginning of the component
    const safeguardedSetMessages = (messageUpdater: Message[] | ((prevMessages: Message[]) => Message[])) => {
        setMessages(prevMessages => {
            let newMessages;

            if (typeof messageUpdater === 'function') {
                newMessages = messageUpdater(prevMessages);
            } else {
                newMessages = messageUpdater;
            }

            // Never allow empty array (causes blank screen)
            if (newMessages.length === 0) {
                console.warn('Prevented setting empty messages array');
                return prevMessages;
            }

            return newMessages;
        });
    };

    // Send a chat message
    const sendChatMessage = () => {
        if (!inputMessage.trim() && codeReferences.length === 0) return;

        // Create a unique ID for this message
        const messageId = `user_${Date.now()}`;

        // Format code references for display in the UI
        const content = [];

        // Add the text content if it's not empty
        if (inputMessage.trim()) {
            content.push({
                type: 'text',
                text: inputMessage
            });
        }

        // Add code references as separate content items - only include file references, not the code itself
        if (codeReferences.length > 0) {
            for (const ref of codeReferences) {
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
            content: content
        };

        // Update messages state with the new message
        safeguardedSetMessages(prevMessages => [...prevMessages, userMessage]);

        // Add the ID to processed set to prevent duplicates if we get it back from the extension
        setProcessedMessageIds(prev => new Set(prev).add(messageId));

        // Send message to extension
        vscode.postMessage({
            command: MessageType.SEND_CHAT_MESSAGE,
            text: inputMessage,
            codeReferences: codeReferences,
            messageId: messageId,
            sessionId: currentSessionId
        });

        // Reset input and code references
        setInputMessage('');
        setCodeReferences([]);
        setIsLoading(true);
        setCurrentMessageId(messageId);
        setIntermediateText(null); // Clear any previous intermediate text
    };

    // Stop AI generation
    const stopGeneration = () => {
        vscode.postMessage({
            command: MessageType.STOP_GENERATION
        });
        setIsLoading(false);
        console.log('Setting isLoading to FALSE (stop generation)');
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendChatMessage();
    };

    // Handle input change 
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputMessage(e.target.value);
    };

    // Helper to check if two messages have identical content
    const messagesHaveIdenticalContent = (msg1: Message, msg2: Message): boolean => {
        if (msg1.role !== msg2.role) return false;
        if (!msg1.content || !msg2.content) return false;
        if (msg1.content.length !== msg2.content.length) return false;

        for (let i = 0; i < msg1.content.length; i++) {
            if (msg1.content[i].type !== msg2.content[i].type) return false;
            if (msg1.content[i].text !== msg2.content[i].text) return false;
        }

        return true;
    };

    // Render content of a message
    const renderMessageContent = (content: any[]) => {
        // If content array is empty or null/undefined, show a placeholder
        if (!content || content.length === 0) {
            return (
                <div className="message-text empty-message">
                    <i>Empty response. Waiting for content...</i>
                </div>
            );
        }

        // Create a filtered array of valid content items
        const validItems = content.filter(item => {
            // First check if item exists
            if (!item) {
                return false;
            }

            // Check if it's a text item (most common)
            if (item.type === 'text') {
                // Allow even empty strings during generation
                return typeof item.text === 'string';
            }

            // Other content types might be valid, keep them
            return true;
        });

        // If we have no valid items after filtering, show the fallback
        if (validItems.length === 0) {
            return (
                <div className="message-text empty-message">
                    <i>Waiting for response content...</i>
                </div>
            );
        }

        // Map valid content items to components
        return validItems.map((item, index) => {
            if (item.type === 'text') {
                // If the text is empty, show generating message
                if (!item.text || item.text.trim() === '') {
                    return (
                        <div key={index} className="message-text empty-message">
                            <i>Generating content...</i>
                        </div>
                    );
                }

                // Check if the content appears to be JSON data that needs parsing
                let textContent = item.text;
                if (typeof textContent === 'string' && textContent.trim().startsWith('data:')) {
                    try {
                        // Extract the JSON part
                        const jsonMatch = textContent.match(/data:\s*(\{.*\})/);
                        if (jsonMatch && jsonMatch[1]) {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            if (jsonData.message && typeof jsonData.message === 'string') {
                                textContent = jsonData.message;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON in message:', e);
                    }
                }

                return (
                    <div key={index} className="message-text">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Custom code block rendering with syntax highlighting
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const lang = match ? match[1] : '';

                                    if (!inline) {
                                        return (
                                            <SyntaxHighlighter
                                                style={{
                                                    ...vscDarkPlus,
                                                    'pre[class*="language-"]': {
                                                        background: 'var(--vscode-textCodeBlock-background)'
                                                    },
                                                    'code[class*="language-"]': {
                                                        background: 'var(--vscode-textCodeBlock-background)'
                                                    }
                                                }}
                                                language={lang || 'text'}
                                                PreTag="div"
                                                wrapLongLines={true}
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        );
                                    }

                                    // For inline code, use the VSCode theme variables directly
                                    return (
                                        <code
                                            className={`inline-code ${className || ''}`}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {textContent}
                        </ReactMarkdown>
                    </div>
                );
            } else {
                return null;
            }
        });
    };

    // Component to show generating response with intermediate content
    const GeneratingIndicator = ({ onStop, intermediateContent = null }) => {
        return (
            <div className="generating-container">
                {intermediateContent && (
                    <div className="intermediate-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const lang = match ? match[1] : '';

                                    if (!inline) {
                                        return (
                                            <SyntaxHighlighter
                                                style={{
                                                    ...vscDarkPlus,
                                                    'pre[class*="language-"]': {
                                                        background: 'var(--vscode-textCodeBlock-background)'
                                                    },
                                                    'code[class*="language-"]': {
                                                        background: 'var(--vscode-textCodeBlock-background)'
                                                    }
                                                }}
                                                language={lang || 'text'}
                                                PreTag="div"
                                                wrapLongLines={true}
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        );
                                    }

                                    return (
                                        <code
                                            className={`inline-code ${className || ''}`}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {intermediateContent}
                        </ReactMarkdown>
                    </div>
                )}
                <div className="generating-indicator">
                    <span>Generating response</span>
                    <div className="generating-actions">
                        <button
                            className="stop-button"
                            onClick={onStop}
                            title="Stop generation"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Copy message content to clipboard
    const copyMessageToClipboard = (message: Message) => {
        if (!message.content || message.content.length === 0) return;

        // Collect all text content
        const textContent = message.content
            .filter(item => item && item.type === 'text' && item.text && item.text.trim() !== '')
            .map(item => item.text)
            .join('\n\n');

        if (textContent) {
            navigator.clipboard.writeText(textContent).then(() => {
                // Show success animation
                if (message.id) {
                    setCopiedMessageId(message.id);
                    // Reset after animation completes
                    setTimeout(() => setCopiedMessageId(null), 600);
                }
            });
        }
    };

    // Remove code reference
    const removeCodeReference = (id: string) => {
        setCodeReferences(prev => prev.filter(ref => ref.id !== id));
    };

    // Code reference chip component
    const CodeReferenceChip = ({ codeRef, onRemove }: { codeRef: CodeReference, onRemove: () => void }) => (
        <div className="code-reference-chip">
            <span style={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
                <i className="codicon codicon-file-code"></i>
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>{codeRef.fileName}:{codeRef.startLine}-{codeRef.endLine}</span>
            <button
                onClick={onRemove}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 0 6px',
                    color: 'var(--vscode-editor-foreground)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    opacity: 0.7
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
            >
                <i className="codicon codicon-close"></i>
            </button>
        </div>
    );

    // Request workspace context
    const getWorkspaceContext = () => {
        vscode.postMessage({
            command: MessageType.GET_WORKSPACE_CONTEXT
        });
    };

    // Request workspace context on component mount
    useEffect(() => {
        getWorkspaceContext();

        // Set up a timer to periodically refresh the context
        const timer = setInterval(() => {
            getWorkspaceContext();
        }, 30000); // Every 30 seconds

        return () => clearInterval(timer);
    }, []);

    // Context info button component
    const ContextInfoButton = () => (
        <div
            className="context-info-button"
            style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px',
                color: 'var(--vscode-descriptionForeground)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px',
                backgroundColor: showContextInfo ? 'var(--vscode-button-background)' : 'transparent',
                opacity: showContextInfo ? 1 : 0.7,
                marginLeft: '8px'
            }}
            onClick={() => setShowContextInfo(!showContextInfo)}
            title="Show/hide workspace context"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style={{ marginRight: '3px' }}>
                <path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.5l-.354.146L5 13.293V11.5l-.5-.5H2V3h12v8z" />
                <path d="M7 5h1v1H7zm2 3V7H8v1h1zm0 0H8v1h1v-1z" />
            </svg>
            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspaceContext?.currentFile?.split('/').pop() || 'Context'}
            </span>
        </div>
    );

    // Context info panel
    const ContextInfoPanel = () => {
        if (!workspaceContext || !showContextInfo) return null;

        return (
            <div
                className="context-info-panel"
                style={{
                    position: 'absolute',
                    top: '32px',
                    right: '8px',
                    width: '250px',
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-panel-border)',
                    borderRadius: '4px',
                    padding: '8px',
                    zIndex: 10,
                    fontSize: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
            >
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Current Context</div>

                {workspaceContext.currentFile && (
                    <div style={{ marginBottom: '4px' }}>
                        <strong>File:</strong> {workspaceContext.currentFile}
                    </div>
                )}

                {workspaceContext.currentLanguage && (
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Language:</strong> {workspaceContext.currentLanguage}
                    </div>
                )}

                {workspaceContext.projectType && (
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Project Type:</strong> {workspaceContext.projectType}
                    </div>
                )}

                {workspaceContext.diagnostics && (
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Issues:</strong> {workspaceContext.diagnostics.length}
                    </div>
                )}

                {workspaceContext.openFiles && (
                    <div style={{ marginBottom: '4px' }}>
                        <strong>Open Files:</strong> {workspaceContext.openFiles.length}
                    </div>
                )}

                <button
                    style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '11px'
                    }}
                    onClick={() => vscode.postMessage({ command: 'goose.getDiagnostics' })}
                >
                    Ask About Current Issues
                </button>
            </div>
        );
    };

    // Request sessions list
    const fetchSessions = () => {
        try {
            console.log('Fetching sessions...');
            vscode.postMessage({
                command: MessageType.GET_SESSIONS
            });
        } catch (err) {
            console.error('Error fetching sessions:', err);
            // Ensure sessions state is valid even on error
            setSessions([]);
        }
    };

    const handleSessionSelect = (sessionId: string) => {
        if (isLoading) return; // Prevent session switching during generation

        // If we're already on this session, just close the drawer
        if (sessionId === currentSessionId) {
            setShowSessionDrawer(false);
            return;
        }

        vscode.postMessage({
            command: MessageType.SWITCH_SESSION,
            sessionId
        });

        // Close the drawer after selection
        setShowSessionDrawer(false);
    };

    const handleCreateSession = () => {
        if (isLoading) return; // Prevent session creation during generation

        vscode.postMessage({
            command: MessageType.CREATE_SESSION
        });

        // Close the drawer after creation request
        setShowSessionDrawer(false);
    };

    const handleRenameSession = (sessionId: string) => {
        if (isLoading) return; // Prevent session renaming during generation

        vscode.postMessage({
            command: MessageType.RENAME_SESSION,
            sessionId
        });
    };

    const handleDeleteSession = (sessionId: string) => {
        if (isLoading) return; // Prevent session deletion during generation

        vscode.postMessage({
            command: MessageType.DELETE_SESSION,
            sessionId
        });
    };

    const toggleSessionDrawer = () => {
        if (isLoading) return; // Prevent toggling during generation

        // If we're opening the drawer, refresh the sessions list
        if (!showSessionDrawer) {
            fetchSessions();
        }

        setShowSessionDrawer(!showSessionDrawer);
    };

    // Find the current session from the sessions list with safer approach
    const currentSession = React.useMemo(() => {
        if (!Array.isArray(sessions) || sessions.length === 0 || !currentSessionId) {
            return null;
        }

        const session = sessions.find(s => s && s.id === currentSessionId);

        // Validate session structure
        if (!session || !session.metadata || typeof session.metadata !== 'object') {
            return null;
        }

        return session;
    }, [sessions, currentSessionId]);

    // Render function
    return (
        <div className="container">
            <Header
                status={serverStatus}
                currentSession={currentSession}
                onToggleSessionDrawer={toggleSessionDrawer}
                isGenerating={isLoading}
            />

            {showSessionDrawer && (
                <SessionList
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onSessionSelect={handleSessionSelect}
                    onCreateSession={handleCreateSession}
                    onRenameSession={handleRenameSession}
                    onDeleteSession={handleDeleteSession}
                />
            )}

            {errorMessage && (
                <div className="error-message">
                    {errorMessage}
                </div>
            )}

            <div className="message-container">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-content">
                            <h3>No messages yet</h3>
                            <p>Start a conversation with Goose to get help with your code.</p>
                        </div>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const isUser = message.role === 'user';
                        const messageText = message.content
                            .filter((item) => item.type === 'text')
                            .map((item) => item.text)
                            .join('\n');

                        // Create a group for consecutive messages from the same sender
                        const prevMessage = index > 0 ? messages[index - 1] : null;
                        const isFirstInGroup = !prevMessage || prevMessage.role !== message.role;

                        return (
                            <div
                                key={message.id}
                                className={`message-group ${isFirstInGroup ? 'first-in-group' : ''}`}
                            >
                                {isFirstInGroup && (
                                    <div className="vscode-message-group-header">
                                        <div className="vscode-message-group-role">
                                            {isUser ? 'You' : 'Goose'}
                                        </div>
                                        <div className="vscode-message-group-time">
                                            {new Date(message.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`message ${isUser ? 'user' : 'ai'}`}
                                >
                                    <div className="message-content">
                                        {isUser ? (
                                            <div className="message-text">{messageText}</div>
                                        ) : (
                                            <div className="message-text markdown">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {messageText}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        <div className="message-actions">
                                            <button
                                                className={`copy-button ${copiedMessageId === message.id ? 'copied' : ''}`}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(messageText);
                                                    setCopiedMessageId(message.id);
                                                    setTimeout(() => setCopiedMessageId(null), 2000);
                                                }}
                                                title="Copy message"
                                            >
                                                {copiedMessageId === message.id ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Loading/generating indicator */}
                {isLoading && (
                    <div className="generating-container">
                        <div className="generating-indicator">
                            <div className="dot-pulse"></div>
                            <span>Generating...</span>
                            <button
                                className="stop-generation-button"
                                onClick={stopGeneration}
                                title="Stop generation"
                            >
                                Stop
                            </button>
                        </div>
                        {intermediateText && (
                            <div className="intermediate-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {intermediateText}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
                {codeReferences.length > 0 && (
                    <div className="code-references">
                        {codeReferences.map((ref) => (
                            <div key={ref.id} className="code-reference-chip">
                                <span title={`${ref.filePath}:${ref.startLine}-${ref.endLine}`}>
                                    {ref.fileName}:{ref.startLine}-{ref.endLine}
                                </span>
                                <button
                                    onClick={() => {
                                        setCodeReferences(codeReferences.filter(r => r.id !== ref.id));
                                    }}
                                    title="Remove code reference"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-row">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendChatMessage();
                            }
                        }}
                        placeholder="Ask Goose a question..."
                        disabled={isLoading}
                    />

                    <button
                        onClick={isLoading ? stopGeneration : sendChatMessage}
                        disabled={(!inputMessage.trim() && codeReferences.length === 0) && !isLoading}
                        title={isLoading ? 'Stop generation' : 'Send message'}
                    >
                        {isLoading ? 'Stop' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
