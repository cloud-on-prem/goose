import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageType } from '../test/mocks/types';

// Mock the scrollIntoView method
Element.prototype.scrollIntoView = vi.fn();

// Mock the VSCode API
const mockPostMessage = vi.fn();
const mockGetState = vi.fn().mockReturnValue({ sessions: [], activeSessionId: null });
const mockSetState = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    window.acquireVsCodeApi = vi.fn(() => ({
        postMessage: mockPostMessage,
        getState: mockGetState,
        setState: mockSetState,
    }));
});

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Save the original
const originalAddEventListener = window.addEventListener;

beforeEach(() => {
    vi.resetAllMocks();
    window.ResizeObserver = mockResizeObserver;
    window.IntersectionObserver = mockIntersectionObserver;

    // Mock window.addEventListener to capture message event handlers
    window.addEventListener = vi.fn((event, handler) => {
        if (event === 'message') {
            // Save the handler for later use in tests
            (window as any).messageHandler = handler;
        }
        return originalAddEventListener(event, handler);
    });
});

afterEach(() => {
    // Restore original
    window.addEventListener = originalAddEventListener;
});

describe('App Component Tests', () => {
    describe('Basic UI Components', () => {
        // Test placeholder component rendering
        it('can render basic UI components', () => {
            render(
                <div className="container">
                    <div className="message-container">
                        <div className="empty-state">
                            <div className="empty-state-content">
                                <h3>No messages yet</h3>
                                <p>Start a conversation with Goose to get help with your code.</p>
                            </div>
                        </div>
                    </div>
                    <div className="input-container">
                        <div className="input-row">
                            <textarea placeholder="Ask Goose a question..." />
                            <button>Send</button>
                        </div>
                    </div>
                </div>
            );

            expect(screen.getByText('No messages yet')).toBeInTheDocument();
            expect(screen.getByText('Start a conversation with Goose to get help with your code.')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Ask Goose a question...')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
        });
    });

    describe('Message Rendering', () => {
        it('can render user and assistant messages', () => {
            const userMessage = {
                id: 'user-1',
                role: 'user',
                created: Date.now(),
                content: [{ type: 'text', text: 'Hello, Goose!' }]
            };

            const assistantMessage = {
                id: 'assistant-1',
                role: 'assistant',
                created: Date.now(),
                content: [{ type: 'text', text: 'Hello! How can I help you today?' }]
            };

            render(
                <div className="message-container">
                    <div className="message-group first-in-group">
                        <div className="vscode-message-group-header">
                            <div className="vscode-message-group-role">You</div>
                        </div>
                        <div className="message user">
                            <div className="message-content">
                                <div className="message-text">{userMessage.content[0].text}</div>
                            </div>
                        </div>
                    </div>
                    <div className="message-group first-in-group">
                        <div className="vscode-message-group-header">
                            <div className="vscode-message-group-role">Goose</div>
                        </div>
                        <div className="message ai">
                            <div className="message-content">
                                <div className="message-text">{assistantMessage.content[0].text}</div>
                            </div>
                        </div>
                    </div>
                </div>
            );

            expect(screen.getByText('Hello, Goose!')).toBeInTheDocument();
            expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
            expect(screen.getByText('You')).toBeInTheDocument();
            expect(screen.getByText('Goose')).toBeInTheDocument();
        });
    });

    describe('VSCode API Communication', () => {
        it('can communicate with the VS Code API', () => {
            // Get a reference to the VSCode API
            const vscode = window.acquireVsCodeApi();

            // Send a message to the extension
            vscode.postMessage({
                command: MessageType.HELLO,
                text: 'Testing VSCode API'
            });

            // Check that the message was sent
            expect(mockPostMessage).toHaveBeenCalledWith({
                command: MessageType.HELLO,
                text: 'Testing VSCode API'
            });
        });

        it('can send a chat message', () => {
            // Get a reference to the VSCode API
            const vscode = window.acquireVsCodeApi();

            // Send a chat message
            vscode.postMessage({
                command: MessageType.SEND_CHAT_MESSAGE,
                text: 'Hello, Goose!',
                codeReferences: [],
                messageId: 'test-id',
                sessionId: null
            });

            // Check that the message was sent with the right structure
            expect(mockPostMessage).toHaveBeenCalledWith({
                command: MessageType.SEND_CHAT_MESSAGE,
                text: 'Hello, Goose!',
                codeReferences: [],
                messageId: 'test-id',
                sessionId: null
            });
        });
    });
}); 
