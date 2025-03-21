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
    CHAT_RESPONSE = 'chatResponse'
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

    // Scroll to bottom whenever messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        // Initial setup
        sendHelloMessage();

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
            messageId: messageId
        });

        // Reset input and code references
        setInputMessage('');
        setCodeReferences([]);
        setIsLoading(true);
        setCurrentMessageId(messageId);
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

    // Header component for server status display
    const Header = () => {
        let statusDisplay = "STOPPED";
        let statusClass = "status-stopped";

        switch (serverStatus) {
            case 'running':
                statusDisplay = "RUNNING";
                statusClass = "status-running";
                break;
            case 'starting':
                statusDisplay = "STARTING";
                statusClass = "status-starting";
                break;
            case 'error':
                statusDisplay = "ERROR";
                statusClass = "status-error";
                break;
            case 'stopped':
            default:
                if (isLoading) {
                    statusDisplay = "GENERATING";
                    statusClass = "status-generating";
                }
                break;
        }

        return (
            <div className="vscode-header">
                <div className="vscode-title">Goose</div>
                <div className="vscode-file-indicator">
                    {editorFile && (
                        <span>{editorFile}</span>
                    )}
                </div>
                <div className={`vscode-status ${statusClass}`}>
                    {statusDisplay}
                </div>
                <div className="vscode-actions">
                    <button
                        className="vscode-action-button"
                        onClick={() => setShowDebug(!showDebug)}
                    >
                        <i className="codicon codicon-debug"></i>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="container" style={{ position: 'relative' }}>
            <div className="vscode-chat-container">
                {/* Header */}
                <Header />

                {/* Context info panel */}
                <ContextInfoPanel />

                {/* Debug Panel */}
                {showDebug && (
                    <div className="vscode-debug-panel">
                        <h3>Debug Information</h3>
                        <p>Messages Count: {messages.length}</p>
                        <p>Is Loading: {isLoading ? 'Yes' : 'No'}</p>
                        <p>Server Status: {serverStatus}</p>
                        <p>Error: {errorMessage ? errorMessage : 'None'}</p>
                        <details>
                            <summary>CSS Debugging Tips</summary>
                            <ol>
                                <li>Check rendered HTML in Developer Tools (F12)</li>
                                <li>Inspect message-text elements and their margins</li>
                                <li>Look for conflicting CSS rules in paragraph and pre elements</li>
                            </ol>
                        </details>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button onClick={() => {
                                // Add a test message to see styling
                                const testMessage: Message = {
                                    id: `test-${Date.now()}`,
                                    role: 'assistant',
                                    created: Date.now(),
                                    content: [{
                                        type: 'text',
                                        text: "This is a `test message` with multiple lines\n\nHere are some things I can help with:\n\n- Code development and editing\n- Running shell commands\n- Exploring project structures\n- Debugging issues\n\nHere's some code:\n\n```python\ndef test():\n    print('hello')\n```\n\nAnd some more text\n\nAnd another code block:\n\n```javascript\nfunction test() {\n  console.log('Hello');\n}\n```\n\nAnd final text paragraph here."
                                    }]
                                };
                                safeguardedSetMessages(prev => [...prev, testMessage]);
                            }}>
                                Add Test Message
                            </button>
                            <button onClick={() => {
                                // Simulate an error
                                setErrorMessage("This is a simulated error message for testing");
                                setIsLoading(false);
                            }}>
                                Simulate Error
                            </button>
                            <button onClick={() => {
                                // Toggle loading state
                                setIsLoading(!isLoading);
                            }}>
                                Toggle Loading
                            </button>
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                <div className="vscode-chat-messages">
                    {messages.length === 0 ? (
                        <div className="vscode-empty-state">
                            <p>No messages yet. Start a conversation!</p>
                        </div>
                    ) : (
                        <>
                            {/* Render all messages */}
                            {messages.map((message, index) => {
                                const messageContent = renderMessageContent(message.content);
                                // Only render the message if it has valid content
                                if (!messageContent) return null;

                                return (
                                    <div key={message.id || index} className="vscode-message-container">
                                        <div className={`vscode-message-header ${message.role}`}>
                                            {message.role === 'user' ? 'You' : 'Goose'}
                                        </div>
                                        <div className={`vscode-message-content ${message.role}`}>
                                            {messageContent}
                                        </div>

                                        {/* Replace the action buttons with just a single copy button */}
                                        <div className="vscode-message-actions">
                                            <button
                                                className={`vscode-action-button ${message.id && copiedMessageId === message.id ? 'copy-success' : ''}`}
                                                title="Copy to clipboard"
                                                onClick={() => copyMessageToClipboard(message)}
                                            >
                                                <i className="codicon codicon-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Error Message (placed in chat flow) */}
                            {errorMessage && (
                                <div className="vscode-error-message">
                                    Error: {errorMessage}
                                </div>
                            )}

                            {/* Show generating indicator if loading */}
                            {isLoading && !errorMessage && (
                                <GeneratingIndicator onStop={stopGeneration} />
                            )}

                            {/* Debug indicator for isLoading state */}
                            {showDebug && (
                                <div style={{ padding: '10px', background: 'rgba(255,0,0,0.1)', margin: '10px 0' }}>
                                    isLoading: {isLoading ? 'TRUE' : 'FALSE'}
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <div className="vscode-input-container">
                    <form onSubmit={handleSubmit} className="vscode-input-form">
                        {/* Code references */}
                        {codeReferences.length > 0 && (
                            <div className="code-references-container">
                                {codeReferences.map(ref => (
                                    <CodeReferenceChip
                                        key={ref.id}
                                        codeRef={ref}
                                        onRemove={() => removeCodeReference(ref.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Input field */}
                        <div className={`input-wrapper ${codeReferences.length > 0 ? 'with-references' : ''}`}>
                            <input
                                type="text"
                                className="message-input"
                                value={inputMessage}
                                onChange={handleInputChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="Ask Goose anything..."
                            />
                            <button
                                className="send-button"
                                onClick={handleSubmit}
                                disabled={serverStatus !== 'running' || isLoading || (!inputMessage.trim() && codeReferences.length === 0)}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                    <path d="M14.5 8L4 3v3.5L9 8 4 9.5V13l10.5-5z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default App;
