import React, { useState, useCallback, useEffect } from 'react';
import './vscodeStyles.css'; // Import VS Code theme variables
// Import new components
import { Header } from './components/Header';
import { SessionList } from './components/SessionList';
import MessageList from './components/messages/MessageList';
import { ChatInput } from './components/input/ChatInput';
import { ContextInfoButton } from './components/context/ContextInfoButton';
import { ContextInfoPanel } from './components/context/ContextInfoPanel';

// Import hooks
import { useVSCodeMessaging } from './hooks/useVSCodeMessaging';
import { useSessionManagement } from './hooks/useSessionManagement';

// Import types
import { Message } from './types/index';

const App: React.FC = () => {
    // State for UI elements
    const [inputMessage, setInputMessage] = useState<string>('');
    const [showContextInfo, setShowContextInfo] = useState<boolean>(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    // Use the VS Code messaging hook
    const {
        messages,
        serverStatus,
        isLoading,
        intermediateText,
        codeReferences,
        workspaceContext,
        sendChatMessage,
        stopGeneration
    } = useVSCodeMessaging();

    // Log messages when they change - with error handling
    useEffect(() => {
        try {
            // Use a simpler message logging approach to avoid circular dependencies
            if (messages.length > 0) {
                console.log(`App: messages state updated - count: ${messages.length}, latest role: ${messages[messages.length - 1]?.role || 'unknown'}`);
            } else {
                console.log('App: messages state updated - no messages');
            }
        } catch (err) {
            console.error('Error in messages useEffect:', err);
        }
    }, [messages]);

    // Use the session management hook
    const {
        sessions,
        currentSessionId,
        showSessionDrawer,
        handleSessionSelect,
        handleCreateSession,
        toggleSessionDrawer,
        currentSession
    } = useSessionManagement(isLoading);

    // Handler for sending a chat message
    const handleSendMessage = useCallback(() => {
        if (!inputMessage.trim() && codeReferences.length === 0) {
            return;
        }

        sendChatMessage(inputMessage, codeReferences, currentSessionId);
        setInputMessage('');
    }, [inputMessage, codeReferences, currentSessionId, sendChatMessage]);

    // Handler for copying message content to clipboard
    const handleCopyMessage = useCallback((message: Message) => {
        if (!message.content || message.content.length === 0) {
            return;
        }

        // Collect all text content
        const textContent = message.content
            .filter(item => item.type === 'text' && 'text' in item && item.text && item.text.trim() !== '')
            .map(item => 'text' in item ? item.text : '')
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
    }, []);

    // Handler for removing a code reference
    const handleRemoveCodeReference = useCallback((id: string) => {
        const _updatedReferences = codeReferences.filter(ref => ref.id !== id);
        // Here we would typically update the extension with the new state
        // For now we're just updating our local state which doesn't persist
    }, [codeReferences]);

    return (
        <div className="container">
            <Header
                status={serverStatus}
                currentSession={currentSession}
                onToggleSessionDrawer={toggleSessionDrawer}
                isGenerating={isLoading}
            />

            {showSessionDrawer && (
                <SessionList
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onSessionSelect={handleSessionSelect}
                    onCreateSession={handleCreateSession}
                />
            )}

            <div className="message-container">
                <MessageList
                    messages={messages}
                    isLoading={isLoading}
                    copiedMessageId={copiedMessageId}
                    intermediateText={intermediateText}
                    onCopyMessage={handleCopyMessage}
                    onStopGeneration={stopGeneration}
                />
            </div>

            <ChatInput
                inputMessage={inputMessage}
                codeReferences={codeReferences}
                isLoading={isLoading}
                onInputChange={setInputMessage}
                onSendMessage={handleSendMessage}
                onStopGeneration={stopGeneration}
                onRemoveCodeReference={handleRemoveCodeReference}
            />

            {workspaceContext && (
                <>
                    <ContextInfoButton
                        workspaceContext={workspaceContext}
                        showContextInfo={showContextInfo}
                        onToggleContextInfo={() => setShowContextInfo(!showContextInfo)}
                    />
                    <ContextInfoPanel
                        workspaceContext={workspaceContext}
                        showContextInfo={showContextInfo}
                    />
                </>
            )}
        </div>
    );
};

export default App;
