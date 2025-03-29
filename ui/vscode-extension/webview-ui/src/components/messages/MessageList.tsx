import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Message as MessageType } from '../../types';
import Message from './Message';
import GeneratingIndicator from './GeneratingIndicator';
import './MessageList.css';

interface MessageListProps {
    messages: MessageType[];
    isLoading: boolean;
    copiedMessageId: string | null;
    intermediateText: string | null;
    serverStatus: string;
    onCopyMessage: (message: MessageType) => void;
    onStopGeneration: () => void;
    restartServer: () => void;
}

const MessageList: React.FC<MessageListProps> = ({
    messages,
    isLoading,
    copiedMessageId,
    intermediateText,
    serverStatus,
    onCopyMessage,
    onStopGeneration,
    restartServer
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const generatingIndicatorRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const prevServerStatusRef = useRef(serverStatus);

    // Scroll to bottom of message list when messages change
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current && autoScroll) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messagesEndRef, autoScroll]);

    // Set up scroll event listener and flag component as mounted
    useEffect(() => {
        setIsMounted(true);

        const handleScroll = () => {
            if (!messagesEndRef.current) {
                return;
            }

            const container = document.querySelector('.message-list');
            if (container) {
                const { scrollTop, scrollHeight, clientHeight } = container;
                const scrolledToBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
                setAutoScroll(scrolledToBottom);
            }
        };

        const container = document.querySelector('.message-list');
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (isMounted) {
            scrollToBottom();
        }
    }, [isMounted, scrollToBottom, messages.length, intermediateText]);

    // Scroll error message into view when it appears
    useEffect(() => {
        // If server status changes to stopped/error, scroll the error message into view
        if (
            (serverStatus === 'stopped' || serverStatus === 'error') &&
            prevServerStatusRef.current !== serverStatus &&
            generatingIndicatorRef.current
        ) {
            generatingIndicatorRef.current.scrollIntoView({ behavior: 'smooth' });
        }

        // Store the current status for the next render
        prevServerStatusRef.current = serverStatus;
    }, [serverStatus]);

    if (messages.length === 0) {
        return (
            <div className="message-list empty-message-list">
                <div className="empty-state">
                    <h2>Ask me something about your code</h2>
                    <p>I'll help you understand your codebase, write tests, fix bugs, and more.</p>
                </div>
                <div ref={messagesEndRef} />
            </div>
        );
    }

    // Filter out messages with empty content before mapping - without useMemo for now
    const filteredMessages = messages.filter(message => {
        // Skip messages with no content array
        if (!message.content || !Array.isArray(message.content)) {
            return false;
        }

        // For messages from a loaded session, be more permissive
        if (message.fromLoadedSession) {
            return true;
        }

        // Check if message has any non-empty text content
        const hasTextContent = message.content.some(item =>
            item.type === 'text' && 'text' in item && item.text && item.text.trim() !== ''
        );

        // Check if message has any non-text content (like tool calls)
        const hasNonTextContent = message.content.some(item => item.type !== 'text');

        // Keep messages that have either text content or non-text content
        return hasTextContent || hasNonTextContent;
    });

    // Log message counts without using useEffect - commented out to debug
    // console.log('MessageList received messages:', messages.length);
    // console.log('MessageList filtered messages:', filteredMessages.length);

    return (
        <div className="message-list">
            {filteredMessages.map((message, index) => {
                // Generate a stable key for the message
                const messageKey = message.id || `msg_${index}_${message.role}_${message.created || Date.now()}`;

                return (
                    <Message
                        key={messageKey}
                        message={message}
                        copiedMessageId={copiedMessageId}
                        onCopyMessage={onCopyMessage}
                    />
                );
            })}

            {/* Loading/generating indicator or server error message */}
            {(isLoading || serverStatus === 'stopped' || serverStatus === 'error') && (
                <div ref={generatingIndicatorRef}>
                    <GeneratingIndicator
                        onStop={serverStatus === 'stopped' || serverStatus === 'error' ? restartServer : onStopGeneration}
                        intermediateContent={intermediateText}
                        errorMessage={
                            serverStatus === 'stopped' || serverStatus === 'error'
                                ? 'The Goose server process has exited.'
                                : null
                        }
                    />
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList; 
