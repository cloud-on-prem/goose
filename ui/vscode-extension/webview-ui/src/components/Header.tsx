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
    // Display GENERATING status when isGenerating is true, otherwise show the actual status
    let displayStatus = isGenerating ? 'GENERATING' : status;

    // Change "running" to "SERVER CONNECTED" for better clarity
    if (displayStatus === 'running') {
        displayStatus = 'SERVER CONNECTED';
    }

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
                        {displayStatus}
                    </div>
                </div>
            </div>
        </div>
    );
}; 
