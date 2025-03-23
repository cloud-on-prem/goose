import React from 'react';
import { SessionMetadata } from './SessionList';

interface SessionIndicatorProps {
    currentSession: SessionMetadata | null;
    onToggleSessionDrawer: () => void;
    isGenerating: boolean;
}

export const SessionIndicator: React.FC<SessionIndicatorProps> = ({
    currentSession,
    onToggleSessionDrawer,
    isGenerating
}) => {
    // Add safety check for currentSession and its properties
    const isValidSession = currentSession &&
        typeof currentSession === 'object' &&
        currentSession.metadata &&
        typeof currentSession.metadata === 'object';

    const sessionName = isValidSession
        ? (currentSession.metadata.title || `Session ${currentSession.id.slice(0, 8)}`)
        : 'New Chat';

    return (
        <div
            className={`vscode-session-indicator ${isGenerating ? 'disabled' : ''}`}
            onClick={isGenerating ? undefined : onToggleSessionDrawer}
            title={isGenerating ? 'Cannot change sessions while generating' : 'Click to manage sessions'}
            style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}
        >
            <i className="codicon codicon-comment-discussion" style={{ flexShrink: 0 }}></i>
            <span className="vscode-session-name" style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                minWidth: 0
            }}>{sessionName}</span>
            <i className="codicon codicon-chevron-down" style={{ flexShrink: 0 }}></i>
        </div>
    );
}; 
