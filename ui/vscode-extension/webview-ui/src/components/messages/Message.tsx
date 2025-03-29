import React, { memo } from 'react';
import { Message as MessageType } from '../../types';
import { MessageContentRenderer } from './MessageContent';

// Add the SVG for the Goose icon - using the same one from the sidebar
const GooseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" className="goose-icon" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 13.5c1-.3 1.6-.8 1.6-.8l-1.6-1.2c-.8-.5-1.4-1.3-1.8-2.1-.7-1.1-1.5-2-2.6-2.7l-.5-.3c-.2-.1-.3-.3-.3-.5 0-.2 0-.3.1-.4.3-.4 1.8-.8 2-.1.3-.3.7-.5 1-.7l.2-.2c.1-.1.2-.2.3-.3.3-.3.4-.6.4-.8 0-.1-.1-.4-.5-.7.2 0 .4.2.7.4.2-.2.3-.5.5-.8.1-.2 0-.3 0-.3s-.1-.2-.3 0c-.4.2-.7.5-1.1.7 0 0-.4 0-.9.4-.1.1-.2.2-.3.3 0 0 0 0 0 0 0 .1-.1.1-.1.1-.3.3-.5.7-.8 1.1-.2.3-1.9 1.7-2.3 2-.1.1-.2.1-.4.1-.2 0-.4-.1-.5-.3l-.3-.5c-.7-1.1-1.6-2-2.7-2.7-.8-.5-1.5-1.1-2.1-1.8L.9 1.8S.5 2.7.3 3.7c.2.3.8 1 1.6 1.6-.8-.4-1.3-.6-1.8-.9-.1.5 0 1.3 0 1.9.5.2 1.3.5 2.1.7-.7.2-1.4.2-2 .2.1.4.2.8.4 1.1.1.2.2.4.3.5.3.1 1.4.3 2.1.1-.6.2-1.7.6-1.7.6.8 1 1.7 1.8 1.7 1.8 1.4-.7 1.7-.8 2.7-1.5C4.2 11 3.8 11.5 3.3 12l-.3.5c-.2.2-.3.5-.4.7-.4.9-1 2.8-1 2.8-.1.3.1.6.4.5 0 0 1.9-.6 2.8-1 .3-.1.5-.3.7-.4l.5-.3c.1-.1.3-.3.5-.4 0 0 1.2 1.4 2.3 2.3 0 0 .4-1.1.6-1.7-.1.6 0 1.8.1 2.1.2.1.3.2.5.3.4.2.8.3 1.1.4 0-.6 0-1.3.2-2 .2.9.5 1.7.7 2.2.6.1 1.4.1 1.9 0-.2-.5-.5-1-.9-1.8.6.7 1.3 1.4 1.6 1.6z" fill="currentColor" />
    </svg>
);

interface MessageProps {
    message: MessageType;
    copiedMessageId: string | null;
    onCopyMessage: (message: MessageType) => void;
}

// Wrap in memo to prevent unnecessary rerenders
const Message: React.FC<MessageProps> = memo(({
    message,
    copiedMessageId,
    onCopyMessage
}) => {
    // Log message to help debug
    console.log('Rendering message:', message.id, message.role);

    const isUser = message.role === 'user';

    // Get text content of a message for display
    const getMessageText = (message: MessageType): string => {
        if (!message.content) { return ''; }

        return message.content
            .filter(item => item.type === 'text' && 'text' in item)
            .map(item => 'text' in item ? item.text : '')
            .join('\n');
    };

    const messageText = getMessageText(message);

    // Skip rendering completely empty user messages
    if (isUser && (!messageText || messageText.trim() === '')) {
        return null;
    }

    // Format timestamp
    const formatTime = () => {
        const timestamp = typeof message.created === 'number' ?
            message.created : // If it's already a number, use it
            new Date(message.created).getTime(); // Otherwise convert string to number

        return new Date(timestamp).toLocaleTimeString(navigator.language, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    };

    return (
        <div className="message-container">
            <div className="message-header">
                <div className="message-role" title={isUser ? 'You' : 'Goose'}>
                    {isUser ? (
                        <i className="codicon codicon-account" aria-label="You"></i>
                    ) : (
                        <GooseIcon />
                    )}
                </div>
                <div className="message-time">
                    {formatTime()}
                </div>
            </div>

            <div className={`message ${isUser ? 'user' : 'ai'}`}>
                <div className="message-content">
                    {isUser ? (
                        <div className="message-text">
                            {messageText && messageText.trim() !== '' ? (
                                messageText
                            ) : (
                                <i className="empty-content">Empty message</i>
                            )}
                        </div>
                    ) : (
                        <div className="message-text markdown">
                            <MessageContentRenderer content={message.content} />
                        </div>
                    )}

                    <div className="message-actions">
                        <button
                            className={`copy-button ${copiedMessageId === message.id ? 'copied' : ''}`}
                            onClick={() => onCopyMessage(message)}
                            title="Copy message"
                        >
                            <i className={`codicon ${copiedMessageId === message.id ? 'codicon-check' : 'codicon-copy'}`}></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Message; 
