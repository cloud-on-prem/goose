import React, { useEffect, useState, useRef } from 'react';
import './vscodeStyles.css'; // Import VS Code theme variables
// Import React Markdown for rendering markdown content
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

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
interface Message {
    id?: string;
    role: 'user' | 'assistant';
    created: number;
    content: Array<{
        type: string;
        text?: string;
        [key: string]: any;
    }>;
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
    STOP_GENERATION = 'stopGeneration'
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        // Listen for messages from the extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Received message from extension:', message);

            switch (message.command) {
                case MessageType.ACTIVE_EDITOR_CONTENT:
                    setEditorContent(message.content);
                    setEditorFile(message.fileName);
                    setErrorMessage(null);
                    break;
                case MessageType.ERROR:
                    setErrorMessage(message.errorMessage);
                    setIsLoading(false);
                    break;
                case MessageType.SERVER_STATUS:
                    setServerStatus(message.status);
                    break;
                case MessageType.AI_MESSAGE:
                    console.log(`UI received message: id=${message.message.id || 'undefined'}, role=${message.message.role}`);

                    setMessages(prevMessages => {
                        console.log(`Current UI messages count: ${prevMessages.length}`);

                        // If the message has no ID or content is empty, ignore it
                        if (!message.message.content || message.message.content.length === 0) {
                            console.log('Ignoring empty message');
                            return prevMessages;
                        }

                        // Check if this message is identical to the last message
                        const lastMessage = prevMessages.length > 0 ? prevMessages[prevMessages.length - 1] : null;
                        if (lastMessage && messagesHaveIdenticalContent(lastMessage, message.message)) {
                            console.log('Ignoring duplicate message');
                            return prevMessages;
                        }

                        // Append the new message to maintain full chat history
                        const updatedMessages = [...prevMessages, message.message];
                        console.log(`Updated UI messages count: ${updatedMessages.length}`);
                        return updatedMessages;
                    });
                    setIsLoading(false);
                    setCurrentMessageId(null);
                    break;
                default:
                    console.log(`Unhandled message type: ${message.command}`);
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

    // Send a chat message
    const sendChatMessage = () => {
        if (!inputMessage.trim()) return;

        // Create a temporary ID for this message
        const tempId = `user-${Date.now()}`;
        setCurrentMessageId(tempId);

        // Create user message and add to chat
        const userMessage: Message = {
            id: tempId,
            role: 'user',
            created: Date.now(),
            content: [{
                type: 'text',
                text: inputMessage
            }]
        };

        setMessages(prev => [...prev, userMessage]);

        // Send to extension
        vscode.postMessage({
            command: MessageType.SEND_CHAT_MESSAGE,
            text: inputMessage
        });

        // Clear input and set loading
        setInputMessage('');
        setIsLoading(true);
    };

    // Stop AI generation
    const stopGeneration = () => {
        vscode.postMessage({
            command: MessageType.STOP_GENERATION
        });
        setIsLoading(false);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendChatMessage();
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
        // If content array is empty or null/undefined, return nothing
        if (!content || content.length === 0) {
            return null;
        }

        // Filter out empty content items and render valid ones
        return content
            .filter(item => item && item.type === 'text' && item.text && item.text.trim() !== '')
            .map((item, index) => (
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
                                            style={vscDarkPlus}
                                            language={lang || 'text'}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    );
                                }

                                return (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
                    >
                        {item.text.trim()}
                    </ReactMarkdown>
                </div>
            ));
    };

    // Add a separate component for the generating indicator
    const GeneratingIndicator = ({ onStop }: { onStop: () => void }) => (
        <div className="vscode-generating">
            <div className="vscode-generating-text">Generating response</div>
            <div className="vscode-loading-dot">.</div>
            <div className="vscode-loading-dot">.</div>
            <div className="vscode-loading-dot">.</div>
            <button
                onClick={onStop}
                className="vscode-stop-button"
            >
                Stop
            </button>
        </div>
    );

    return (
        <div className="vscode-chat-container">
            {/* Header */}
            <header className="vscode-chat-header">
                <div className="vscode-chat-header-content">
                    <h1 className="vscode-chat-title">Goose Wingman</h1>
                    <div className="vscode-status-container">
                        <span className={`vscode-status-badge ${serverStatus}`}>
                            {serverStatus.toUpperCase()}
                        </span>
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="vscode-debug-button"
                            title="Toggle debug mode"
                        >
                            🐛
                        </button>
                    </div>
                </div>
            </header>

            {/* Debug Panel */}
            {showDebug && (
                <div className="vscode-debug-panel">
                    <h3>Debug Information</h3>
                    <p>Messages Count: {messages.length}</p>
                    <p>Is Loading: {isLoading ? 'Yes' : 'No'}</p>
                    <p>Server Status: {serverStatus}</p>
                    <details>
                        <summary>CSS Debugging Tips</summary>
                        <ol>
                            <li>Check rendered HTML in Developer Tools (F12)</li>
                            <li>Inspect message-text elements and their margins</li>
                            <li>Look for conflicting CSS rules in paragraph and pre elements</li>
                        </ol>
                    </details>
                    <button onClick={() => {
                        // Add a test message to see styling
                        const testMessage: Message = {
                            id: `test-${Date.now()}`,
                            role: 'assistant',
                            created: Date.now(),
                            content: [{
                                type: 'text',
                                text: "This is a test message with multiple lines\n\nHere are some things I can help with:\n\n- Code development and editing\n- Running shell commands\n- Exploring project structures\n- Debugging issues\n\nHere's some code:\n\n```python\ndef test():\n    print('hello')\n```\n\nAnd some more text\n\nAnd another code block:\n\n```javascript\nfunction test() {\n  console.log('Hello');\n}\n```\n\nAnd final text paragraph here."
                            }]
                        };
                        setMessages(prev => [...prev, testMessage]);
                    }}>
                        Add Test Message
                    </button>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="vscode-error-message">
                    Error: {errorMessage}
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
                        {messages.map((message, index) => {
                            const messageContent = renderMessageContent(message.content);
                            // Only render the message if it has valid content
                            if (!messageContent) return null;

                            // Check if this is the last user message
                            const isLastUserMessage = message.role === 'user' &&
                                index === messages.length - 1;

                            return (
                                <React.Fragment key={message.id || index}>
                                    <div className="vscode-message-container">
                                        <div className={`vscode-message-header ${message.role}`}>
                                            {message.role === 'user' ? 'You' : 'Goose'}
                                        </div>
                                        <div className={`vscode-message-content ${message.role}`}>
                                            {messageContent}
                                        </div>
                                    </div>
                                    {isLoading && isLastUserMessage && (
                                        <div className="vscode-generating-container">
                                            <GeneratingIndicator onStop={stopGeneration} />
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="vscode-input-container">
                <form onSubmit={handleSubmit} className="vscode-input-form">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Ask Goose anything..."
                        className="vscode-input"
                        disabled={isLoading || serverStatus !== 'running'}
                    />
                    <button
                        type="submit"
                        className={`vscode-send-button ${isLoading || serverStatus !== 'running' || !inputMessage.trim() ? 'disabled' : ''}`}
                        disabled={isLoading || serverStatus !== 'running' || !inputMessage.trim()}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default App;
