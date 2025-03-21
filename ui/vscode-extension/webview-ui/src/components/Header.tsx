import React from 'react';
import { SessionIndicator } from './SessionIndicator';
import { SessionMetadata } from './SessionList';

interface HeaderProps {
    status: string;
    currentSession: SessionMetadata | null;
    onToggleSessionDrawer: () => void;
    isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    status,
    currentSession,
    onToggleSessionDrawer,
    isGenerating
}) => {
    return (
        <div className="vscode-chat-header">
            <div className="vscode-chat-header-content">
                <div className="vscode-chat-title">Goose</div>

                <SessionIndicator
                    currentSession={currentSession}
                    onToggleSessionDrawer={onToggleSessionDrawer}
                    isGenerating={isGenerating}
                />

                <div className="vscode-status-container">
                    <div className={`vscode-status-badge ${status.toLowerCase()}`}>
                        {status}
                    </div>
                </div>
            </div>
        </div>
    );
}; 
