import React, { memo } from 'react';
import { Message as MessageType } from '../../types';
import { MessageContentRenderer } from './MessageContent';

interface MessageProps {
    message: MessageType;
    isFirstInGroup: boolean;
    copiedMessageId: string | null;
    onCopyMessage: (message: MessageType) => void;
}

// Wrap in memo to prevent unnecessary rerenders
const Message: React.FC<MessageProps> = memo(({
    message,
    isFirstInGroup,
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

    return (
        <div className={`message-group ${isFirstInGroup ? 'first-in-group' : ''}`}>
            {isFirstInGroup && (
                <div className="vscode-message-group-header">
                    <div className="vscode-message-group-role">
                        {isUser ? 'You' : 'Goose'}
                    </div>
                    <div className="vscode-message-group-time">
                        {(() => {
                            // Ensure consistent timestamp handling
                            const timestamp = typeof message.created === 'number' ?
                                message.created : // If it's already a number, use it
                                new Date(message.created).getTime(); // Otherwise convert string to number

                            return new Date(timestamp).toLocaleTimeString(navigator.language, {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            });
                        })()}
                    </div>
                </div>
            )}

            <div className={`message ${isUser ? 'user' : 'ai'}`}>
                <div className="message-content">
                    {isUser ? (
                        <div className="message-text">
                            <div className="message-role">You</div>
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
