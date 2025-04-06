import React, { useRef, useEffect, useState } from 'react';
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [wasLoading, setWasLoading] = useState(false);

    // Track focus state of the webview
    const [isWebviewFocused, setIsWebviewFocused] = useState(true);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    };

    // Set up focus and blur event listeners for the window
    useEffect(() => {
        const handleFocus = () => setIsWebviewFocused(true);
        const handleBlur = () => setIsWebviewFocused(false);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        // Capture initial focus state
        setIsWebviewFocused(document.hasFocus());

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Focus the textarea when isLoading changes from true to false
    // but only if webview still has focus
    useEffect(() => {
        // Track when loading state changes
        if (isLoading !== wasLoading) {
            setWasLoading(isLoading);

            // Focus input only when loading ends AND the webview still has focus
            if (wasLoading && !isLoading && isWebviewFocused && textareaRef.current) {
                // Small delay to ensure UI has updated
                setTimeout(() => {
                    if (document.hasFocus() && textareaRef.current) {
                        textareaRef.current.focus();
                    }
                }, 10);
            }
        }
    }, [isLoading, wasLoading, isWebviewFocused]);

    const isDisabled = (!inputMessage.trim() && codeReferences.length === 0) && !isLoading;

    return (
        <div className="input-container">
            <CodeReferences
                codeReferences={codeReferences}
                onRemoveReference={onRemoveCodeReference}
            />

            <div className="input-row">
                <textarea
                    ref={textareaRef}
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
