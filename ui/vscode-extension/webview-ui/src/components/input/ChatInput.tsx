import React from 'react';
import { CodeReferences } from '../codeReferences/CodeReferences';
import { CodeReference } from '../../types';

interface ChatInputProps {
    inputMessage: string;
    codeReferences: CodeReference[];
    isLoading: boolean;
    onInputChange: (value: string) => void;
    onSendMessage: () => void;
    onStopGeneration: () => void;
    onRemoveCodeReference: (id: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputMessage,
    codeReferences,
    isLoading,
    onInputChange,
    onSendMessage,
    onStopGeneration,
    onRemoveCodeReference
}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    };

    const isDisabled = (!inputMessage.trim() && codeReferences.length === 0) && !isLoading;

    return (
        <div className="input-container">
            <CodeReferences
                codeReferences={codeReferences}
                onRemoveReference={onRemoveCodeReference}
            />

            <div className="input-row">
                <textarea
                    value={inputMessage}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Goose a question..."
                    disabled={isLoading}
                />

                <button
                    onClick={isLoading ? onStopGeneration : onSendMessage}
                    disabled={isDisabled}
                    title={isLoading ? 'Stop generation' : 'Send message'}
                >
                    {isLoading ? 'Stop' : 'Send'}
                </button>
            </div>
        </div>
    );
}; 
