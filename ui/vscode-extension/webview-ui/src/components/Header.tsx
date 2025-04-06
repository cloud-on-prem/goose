import React from 'react';
import { SessionMetadata } from './SessionList';

interface HeaderProps {
    status: string;
    currentSession: SessionMetadata | null;
    onToggleSessionDrawer: () => void;
    isGenerating: boolean;
    onNewSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    status,
    onToggleSessionDrawer,
    isGenerating,
    onNewSession
}) => {
    // Helper to get status display text (incorporating isGenerating)
    const getDisplayStatus = (status: string, isGenerating: boolean): string => {
        if (isGenerating) return 'GENERATING';
        if (status === 'running') return 'SERVER CONNECTED';
        // Add other status mappings as needed (e.g., error details)
        return status.toUpperCase();
    };

    // Helper to get status color theme variable
    const getStatusColorVar = (status: string, isGenerating: boolean): string => {
        console.log('Status:', status, 'isGenerating:', isGenerating); // Debug log

        if (isGenerating) return 'var(--vscode-gitDecoration-modifiedResourceForeground)'; // Blue for Generating

        // Convert status to lowercase for consistent comparison
        const statusLower = status.toLowerCase();
        console.log('Status lowercase:', statusLower); // Debug log

        switch (statusLower) {
            case 'running':
                return 'var(--vscode-testing-iconPassed)'; // Green for running
            case 'error':
            case 'stopped':
                return 'var(--vscode-errorForeground)'; // Red
            case 'connecting':
            case 'initializing':
                return 'var(--vscode-debugIcon-pauseForeground)'; // Yellow/Orange
            default:
                return 'var(--vscode-disabledForeground)'; // Gray
        }
    };

    const displayStatus = getDisplayStatus(status, isGenerating);
    const statusColorVar = getStatusColorVar(status, isGenerating);

    return (
        <div className="vscode-chat-header">
            <div className="header-actions">
                {/* New Session Button */}
                <button
                    className="icon-button"
                    title="New Session"
                    onClick={onNewSession}
                    disabled={isGenerating}
                >
                    <i className="codicon codicon-add"></i>
                </button>

                {/* Session History Button */}
                <button
                    className="icon-button"
                    title="Session History"
                    onClick={onToggleSessionDrawer}
                    disabled={isGenerating}
                >
                    <i className="codicon codicon-history"></i>
                </button>

                {/* Status Indicator Dot */}
                <div
                    className="status-light"
                    title={displayStatus} // Tooltip shows detailed status
                    style={{
                        backgroundColor: statusColorVar,
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        border: '1px solid var(--vscode-panel-border)'
                    }}
                ></div>
            </div>
        </div>
    );
}; 
