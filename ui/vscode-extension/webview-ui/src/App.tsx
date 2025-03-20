import React, { useEffect, useState, useRef } from 'react';
import './vscodeStyles.css'; // Import VS Code theme variables

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
                    setMessages(prevMessages => {
                        // Check if this message is already in the array
                        if (prevMessages.some(m => m.id === message.message.id)) {
                            // Update the existing message
                            return prevMessages.map(m =>
                                m.id === message.message.id ? message.message : m
                            );
                        }
                        // Add new message
                        return [...prevMessages, message.message];
                    });
                    setIsLoading(false);
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

        // Create a user message
        const userMessage: Message = {
            role: 'user',
            created: Math.floor(Date.now() / 1000),
            content: [{ type: 'text', text: inputMessage }]
        };

        // Add to messages
        setMessages(prevMessages => [...prevMessages, userMessage]);

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

    // Render content of a message
    const renderMessageContent = (content: any[]) => {
        return content.map((item, index) => {
            if (item.type === 'text') {
                return <div key={index} className="whitespace-pre-wrap">{item.text}</div>;
            }
            return null;
        });
    };

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
                    </div>
                </div>
            </header>

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
                    messages.map((message, index) => (
                        <div
                            key={message.id || index}
                            className={`vscode-message ${message.role}`}
                        >
                            {renderMessageContent(message.content)}
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="vscode-loading">
                        <div className="vscode-loading-text">Thinking</div>
                        <div className="vscode-loading-dot">.</div>
                        <div className="vscode-loading-dot">.</div>
                        <div className="vscode-loading-dot">.</div>
                        <button
                            onClick={stopGeneration}
                            className="vscode-stop-button"
                        >
                            Stop
                        </button>
                    </div>
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
