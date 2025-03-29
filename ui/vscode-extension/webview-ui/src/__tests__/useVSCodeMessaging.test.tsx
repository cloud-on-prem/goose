import { renderHook, act } from '@testing-library/react';
import { useVSCodeMessaging } from '../hooks/useVSCodeMessaging';
import { MessageType } from '../types';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the vscode API
const mockPostMessage = vi.fn();
const mockGetState = vi.fn();
const mockSetState = vi.fn();

const vscode = {
    postMessage: mockPostMessage,
    getState: mockGetState,
    setState: mockSetState
};

vi.mock('../utils/vscode', () => ({
    getVSCodeAPI: () => vscode
}));

describe('useVSCodeMessaging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window event listeners
        window.removeEventListener = vi.fn();
        window.addEventListener = vi.fn();
        // Setup fake timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('should initialize with stopped server status', () => {
        const { result } = renderHook(() => useVSCodeMessaging());
        expect(result.current.serverStatus).toBe('stopped');
    });

    it('should update server status on SERVER_STATUS message', () => {
        const { result } = renderHook(() => useVSCodeMessaging());

        // Get the message handler
        const messageHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            call => call[0] === 'message'
        )[1];

        // Simulate receiving a server status message
        act(() => {
            messageHandler({
                data: {
                    command: MessageType.SERVER_STATUS,
                    status: 'running'
                }
            });
        });

        expect(result.current.serverStatus).toBe('running');
    });

    it('should handle server exit message', () => {
        const { result } = renderHook(() => useVSCodeMessaging());

        // Get the message handler
        const messageHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            call => call[0] === 'message'
        )[1];

        // Simulate receiving a server exit message
        act(() => {
            messageHandler({
                data: {
                    command: MessageType.SERVER_EXIT,
                    code: 0
                }
            });
        });

        // Server status should be stopped
        expect(result.current.serverStatus).toBe('stopped');

        // We no longer add system messages for server exit
        expect(result.current.messages).toHaveLength(0);
    });

    it('should handle server error message', () => {
        const { result } = renderHook(() => useVSCodeMessaging());

        // Get the message handler
        const messageHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            call => call[0] === 'message'
        )[1];

        // Simulate receiving an error message
        act(() => {
            messageHandler({
                data: {
                    command: MessageType.ERROR,
                    errorMessage: 'fetch failed'
                }
            });
        });

        // Server status should be stopped
        expect(result.current.serverStatus).toBe('stopped');

        // We no longer add system messages for server errors
        expect(result.current.messages).toHaveLength(0);
    });

    it('should not show duplicate error messages', () => {
        const { result } = renderHook(() => useVSCodeMessaging());

        // Get the message handler
        const messageHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            call => call[0] === 'message'
        )[1];

        // Simulate receiving multiple error messages in quick succession
        act(() => {
            messageHandler({
                data: {
                    command: MessageType.ERROR,
                    errorMessage: 'fetch failed'
                }
            });

            // Wait a bit to ensure the first message is processed
            vi.advanceTimersByTime(100);

            messageHandler({
                data: {
                    command: MessageType.ERROR,
                    errorMessage: 'fetch failed'
                }
            });
        });

        // Since we no longer add error messages, expect none
        expect(result.current.messages).toHaveLength(0);
    });

    it('should prevent sending messages when server is stopped', () => {
        const { result } = renderHook(() => useVSCodeMessaging());

        // Clear any initial calls
        mockPostMessage.mockClear();

        // Try to send a message when server is stopped
        act(() => {
            result.current.sendChatMessage('test message', [], null);
        });

        // Should not have sent the chat message
        expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({
            command: MessageType.SEND_CHAT_MESSAGE
        }));

        // Should have added an error message
        expect(result.current.messages[0]).toMatchObject({
            role: 'system',
            content: [{
                type: 'text',
                text: expect.stringContaining('Cannot send message: Goose server is not connected')
            }]
        });
    });
}); 
