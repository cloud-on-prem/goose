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
        ? (currentSession.metadata.description || `Session ${currentSession.id}`)
        : 'No active session';

    return (
        <div
            className={`vscode-session-indicator ${isGenerating ? 'disabled' : ''}`}
            onClick={isGenerating ? undefined : onToggleSessionDrawer}
            title={isGenerating ? 'Cannot change sessions while generating' : 'Click to manage sessions'}
        >
            <i className="codicon codicon-comment-discussion"></i>
            <span className="vscode-session-name">{sessionName}</span>
            <i className="codicon codicon-chevron-down"></i>
        </div>
    );
}; 
