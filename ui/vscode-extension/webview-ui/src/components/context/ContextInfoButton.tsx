import React from 'react';
import { WorkspaceContext } from '../../types';

interface ContextInfoButtonProps {
    workspaceContext: WorkspaceContext | null;
    showContextInfo: boolean;
    onToggleContextInfo: () => void;
}

export const ContextInfoButton: React.FC<ContextInfoButtonProps> = ({
    workspaceContext,
    showContextInfo,
    onToggleContextInfo
}) => (
    <div
        className="context-info-button"
        style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground)',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: '3px',
            backgroundColor: showContextInfo ? 'var(--vscode-button-background)' : 'transparent',
            opacity: showContextInfo ? 1 : 0.7,
            marginLeft: '8px'
        }}
        onClick={onToggleContextInfo}
        title="Show/hide workspace context"
    >
        <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style={{ marginRight: '3px' }}>
            <path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.5l-.354.146L5 13.293V11.5l-.5-.5H2V3h12v8z" />
            <path d="M7 5h1v1H7zm2 3V7H8v1h1zm0 0H8v1h1v-1z" />
        </svg>
        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workspaceContext?.currentFile?.split('/').pop() || 'Context'}
        </span>
    </div>
); 
