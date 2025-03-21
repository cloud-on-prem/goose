import React from 'react';

export interface SessionMetadata {
    id: string;
    metadata: {
        title: string;
        created?: number;
        updated?: number;
    };
}

interface SessionListProps {
    sessions: SessionMetadata[];
    currentSessionId: string | null;
    onSessionSelect: (sessionId: string) => void;
    onCreateSession: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
    sessions,
    currentSessionId,
    onSessionSelect,
    onCreateSession
}) => {
    // Ensure sessions is an array and has valid items
    const validSessions = Array.isArray(sessions)
        ? sessions.filter(session =>
            session &&
            typeof session === 'object' &&
            session.id &&
            session.metadata &&
            typeof session.metadata === 'object')
        : [];

    return (
        <div className="vscode-session-list">
            <div className="vscode-session-list-header">
                <h3>
                    <i className="codicon codicon-history"></i>
                    Sessions
                </h3>
                <button
                    className="vscode-action-button"
                    onClick={onCreateSession}
                    title="Create new session"
                >
                    <i className="codicon codicon-add"></i>
                </button>
            </div>

            <div className="vscode-session-items">
                {validSessions.length === 0 ? (
                    <div className="vscode-empty-sessions">
                        No saved sessions
                    </div>
                ) : (
                    validSessions.map(session => (
                        <div
                            key={session.id}
                            className={`vscode-session-item ${currentSessionId === session.id ? 'active' : ''}`}
                            onClick={() => onSessionSelect(session.id)}
                        >
                            <div className="vscode-session-item-content">
                                <div className="vscode-session-item-name">
                                    {session.metadata.title || `Session ${session.id.slice(0, 6)}`}
                                </div>
                                <div className="vscode-session-item-info">
                                    {new Date(session.metadata.updated || session.metadata.created || Date.now()).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}; 
