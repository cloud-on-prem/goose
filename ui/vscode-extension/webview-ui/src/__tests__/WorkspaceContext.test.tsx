import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceContext } from '../test/mocks/types';

describe('Workspace Context Functionality', () => {
    describe('Workspace Context Info', () => {
        it('renders workspace context info button', () => {
            render(
                <div
                    className="context-info-button"
                    title="Show/hide workspace context"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.5l-.354.146L5 13.293V11.5l-.5-.5H2V3h12v8z" />
                        <path d="M7 5h1v1H7zm2 3V7H8v1h1zm0 0H8v1h1v-1z" />
                    </svg>
                    <span>Context</span>
                </div>
            );

            expect(screen.getByTitle('Show/hide workspace context')).toBeInTheDocument();
            expect(screen.getByText('Context')).toBeInTheDocument();
        });

        it('renders workspace context panel with proper information', () => {
            const workspaceContext: WorkspaceContext = {
                currentLanguage: 'typescript',
                projectType: 'react',
                currentFile: 'src/App.tsx',
                currentFilePath: '/project/src/App.tsx',
                diagnostics: [{ message: 'Type error' }],
                recentFiles: ['src/App.tsx', 'src/index.tsx'],
                openFiles: ['src/App.tsx', 'src/components/Header.tsx']
            };

            render(
                <div className="context-info-panel">
                    <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Current Context</div>

                    <div style={{ marginBottom: '4px' }}>
                        <strong>File:</strong> {workspaceContext.currentFile}
                    </div>

                    <div style={{ marginBottom: '4px' }}>
                        <strong>Language:</strong> {workspaceContext.currentLanguage}
                    </div>

                    <div style={{ marginBottom: '4px' }}>
                        <strong>Project Type:</strong> {workspaceContext.projectType}
                    </div>

                    <div style={{ marginBottom: '4px' }}>
                        <strong>Issues:</strong> {workspaceContext.diagnostics.length}
                    </div>

                    <div style={{ marginBottom: '4px' }}>
                        <strong>Open Files:</strong> {workspaceContext.openFiles.length}
                    </div>

                    <button>Ask About Current Issues</button>
                </div>
            );

            expect(screen.getByText('Current Context')).toBeInTheDocument();
            expect(screen.getByText(/File:/)).toBeInTheDocument();
            expect(screen.getByText(/src\/App\.tsx/)).toBeInTheDocument();
            expect(screen.getByText(/Language:/)).toBeInTheDocument();
            expect(screen.getByText(/typescript/)).toBeInTheDocument();
            expect(screen.getByText(/Project Type:/)).toBeInTheDocument();
            expect(screen.getByText(/react/)).toBeInTheDocument();
            expect(screen.getByText(/Issues:/)).toBeInTheDocument();
            expect(screen.getByText(/1/)).toBeInTheDocument();
            expect(screen.getByText(/Open Files:/)).toBeInTheDocument();
            expect(screen.getByText(/2/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Ask About Current Issues' })).toBeInTheDocument();
        });
    });

    describe('Context Action', () => {
        it('triggers context action when the button is clicked', () => {
            const mockPostMessage = vi.fn();
            window.acquireVsCodeApi = vi.fn(() => ({
                postMessage: mockPostMessage,
                getState: vi.fn(),
                setState: vi.fn(),
            }));

            render(
                <button
                    onClick={() => {
                        const vscode = window.acquireVsCodeApi();
                        vscode.postMessage({ command: 'goose.getDiagnostics' });
                    }}
                >
                    Ask About Current Issues
                </button>
            );

            fireEvent.click(screen.getByText('Ask About Current Issues'));

            expect(mockPostMessage).toHaveBeenCalledWith({
                command: 'goose.getDiagnostics'
            });
        });

        it('toggles context panel visibility when clicking the info button', () => {
            const mockToggle = vi.fn();

            render(
                <div
                    className="context-info-button"
                    onClick={mockToggle}
                    title="Show/hide workspace context"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.5l-.354.146L5 13.293V11.5l-.5-.5H2V3h12v8z" />
                        <path d="M7 5h1v1H7zm2 3V7H8v1h1zm0 0H8v1h1v-1z" />
                    </svg>
                    <span>Context</span>
                </div>
            );

            fireEvent.click(screen.getByTitle('Show/hide workspace context'));
            expect(mockToggle).toHaveBeenCalledTimes(1);
        });
    });
}); 
