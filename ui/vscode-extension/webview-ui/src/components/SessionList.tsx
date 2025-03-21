import React from 'react';

export interface SessionMetadata {
    id: string;
    path: string;
    modified: string;
    metadata: {
        working_dir: string;
        description: string;
        message_count: number;
        total_tokens: number;
    }
}

interface SessionListProps {
    sessions: SessionMetadata[];
    currentSessionId: string | null;
    onSessionSelect: (sessionId: string) => void;
    onCreateSession: () => void;
    onRenameSession?: (sessionId: string) => void;
    onDeleteSession?: (sessionId: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
    sessions,
    currentSessionId,
    onSessionSelect,
    onCreateSession,
    onRenameSession,
    onDeleteSession
}) => {
    // Ensure sessions is an array
    const validSessions = Array.isArray(sessions) ? sessions : [];

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
                    <div className="vscode-empty-sessions">No sessions available</div>
                ) : (
                    validSessions.map(session => {
                        // Handle potentially invalid data
                        const sessionId = session?.id || '';
                        const description = session?.metadata?.description || `Session ${sessionId}`;
                        const modified = session?.modified || new Date().toISOString();
                        const messageCount = session?.metadata?.message_count || 0;

                        return (
                            <div
                                key={sessionId}
                                className={`vscode-session-item ${sessionId === currentSessionId ? 'active' : ''}`}
                                onClick={() => onSessionSelect(sessionId)}
                            >
                                <div className="vscode-session-item-content">
                                    <div className="vscode-session-item-name">
                                        {description}
                                    </div>
                                    <div className="vscode-session-item-info">
                                        {new Date(modified).toLocaleString()} · {messageCount} messages
                                    </div>
                                </div>
                                <div className="vscode-session-item-actions">
                                    {onRenameSession && (
                                        <button
                                            title="Rename session"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRenameSession(sessionId);
                                            }}
                                        >
                                            <i className="codicon codicon-edit"></i>
                                        </button>
                                    )}
                                    {onDeleteSession && (
                                        <button
                                            title="Delete session"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteSession(sessionId);
                                            }}
                                        >
                                            <i className="codicon codicon-trash"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}; 
