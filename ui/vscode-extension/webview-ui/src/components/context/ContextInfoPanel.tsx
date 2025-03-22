import React from 'react';
import { WorkspaceContext } from '../../types';
import { getVSCodeAPI } from '../../utils/vscode';

interface ContextInfoPanelProps {
    workspaceContext: WorkspaceContext | null;
    showContextInfo: boolean;
}

export const ContextInfoPanel: React.FC<ContextInfoPanelProps> = ({
    workspaceContext,
    showContextInfo
}) => {
    if (!workspaceContext || !showContextInfo) {
        return null;
    }

    const vscode = getVSCodeAPI();

    return (
        <div
            className="context-info-panel"
            style={{
                position: 'absolute',
                top: '32px',
                right: '8px',
                width: '250px',
                backgroundColor: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '4px',
                padding: '8px',
                zIndex: 10,
                fontSize: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
        >
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Current Context</div>

            {workspaceContext.currentFile && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>File:</strong> {workspaceContext.currentFile}
                </div>
            )}

            {workspaceContext.currentLanguage && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>Language:</strong> {workspaceContext.currentLanguage}
                </div>
            )}

            {workspaceContext.projectType && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>Project Type:</strong> {workspaceContext.projectType}
                </div>
            )}

            {workspaceContext.diagnostics && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>Issues:</strong> {workspaceContext.diagnostics.length}
                </div>
            )}

            {workspaceContext.openFiles && (
                <div style={{ marginBottom: '4px' }}>
                    <strong>Open Files:</strong> {workspaceContext.openFiles.length}
                </div>
            )}

            <button
                style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '11px'
                }}
                onClick={() => vscode.postMessage({ command: 'goose.getDiagnostics' })}
            >
                Ask About Current Issues
            </button>
        </div>
    );
}; 
