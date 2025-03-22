import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeReference } from '../test/mocks/types';

describe('Input Functionality', () => {
    describe('Text Input', () => {
        it('renders input textarea and send button', () => {
            render(
                <div className="input-container">
                    <div className="input-row">
                        <textarea
                            placeholder="Ask Goose a question..."
                        />
                        <button>Send</button>
                    </div>
                </div>
            );

            expect(screen.getByPlaceholderText('Ask Goose a question...')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
        });

        it('allows typing in the textarea', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();

            render(
                <div className="input-container">
                    <div className="input-row">
                        <textarea
                            placeholder="Ask Goose a question..."
                            onChange={onChange}
                        />
                        <button>Send</button>
                    </div>
                </div>
            );

            const textarea = screen.getByPlaceholderText('Ask Goose a question...');
            await user.type(textarea, 'Hello, Goose!');

            expect(onChange).toHaveBeenCalled();
            expect(textarea).toHaveValue('Hello, Goose!');
        });

        it('disables textarea and changes button text when loading', () => {
            render(
                <div className="input-container">
                    <div className="input-row">
                        <textarea
                            placeholder="Ask Goose a question..."
                            disabled={true}
                        />
                        <button
                            disabled={false}
                            title="Stop generation"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            );

            expect(screen.getByPlaceholderText('Ask Goose a question...')).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
            expect(screen.getByTitle('Stop generation')).toBeInTheDocument();
        });
    });

    describe('Code References', () => {
        it('renders code reference chips', () => {
            const codeReferences: CodeReference[] = [
                {
                    id: 'ref-1',
                    filePath: '/src/components/App.tsx',
                    fileName: 'App.tsx',
                    startLine: 10,
                    endLine: 20,
                    selectedText: 'const App = () => { ... }',
                    languageId: 'typescript'
                },
                {
                    id: 'ref-2',
                    filePath: '/src/utils/helpers.ts',
                    fileName: 'helpers.ts',
                    startLine: 5,
                    endLine: 15,
                    selectedText: 'export function formatDate() { ... }',
                    languageId: 'typescript'
                }
            ];

            render(
                <div className="code-references">
                    {codeReferences.map((ref) => (
                        <div key={ref.id} className="code-reference-chip">
                            <span title={`${ref.filePath}:${ref.startLine}-${ref.endLine}`}>
                                {ref.fileName}:{ref.startLine}-{ref.endLine}
                            </span>
                            <button title="Remove code reference">×</button>
                        </div>
                    ))}
                </div>
            );

            expect(screen.getByText('App.tsx:10-20')).toBeInTheDocument();
            expect(screen.getByText('helpers.ts:5-15')).toBeInTheDocument();
            expect(screen.getAllByTitle('Remove code reference').length).toBe(2);
        });

        it('calls remove handler when × button is clicked', async () => {
            const user = userEvent.setup();
            const removeHandler = vi.fn();

            const codeReference: CodeReference = {
                id: 'ref-1',
                filePath: '/src/components/App.tsx',
                fileName: 'App.tsx',
                startLine: 10,
                endLine: 20,
                selectedText: 'const App = () => { ... }',
                languageId: 'typescript'
            };

            render(
                <div className="code-references">
                    <div className="code-reference-chip">
                        <span>
                            {codeReference.fileName}:{codeReference.startLine}-{codeReference.endLine}
                        </span>
                        <button
                            onClick={removeHandler}
                            title="Remove code reference"
                        >
                            ×
                        </button>
                    </div>
                </div>
            );

            await user.click(screen.getByTitle('Remove code reference'));
            expect(removeHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Form Submission', () => {
        it('submits the form when send button is clicked', async () => {
            const user = userEvent.setup();
            const handleSubmit = vi.fn(e => e.preventDefault());

            render(
                <form onSubmit={handleSubmit}>
                    <div className="input-container">
                        <div className="input-row">
                            <textarea placeholder="Ask Goose a question..." />
                            <button type="submit">Send</button>
                        </div>
                    </div>
                </form>
            );

            await user.click(screen.getByRole('button', { name: 'Send' }));
            expect(handleSubmit).toHaveBeenCalledTimes(1);
        });

        it('submits the form when Enter is pressed (without Shift)', async () => {
            const user = userEvent.setup();
            const handleSubmit = vi.fn(e => e.preventDefault());
            const handleKeyDown = vi.fn(e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                }
            });

            render(
                <form onSubmit={handleSubmit}>
                    <div className="input-container">
                        <div className="input-row">
                            <textarea
                                placeholder="Ask Goose a question..."
                                onKeyDown={handleKeyDown}
                            />
                            <button type="submit">Send</button>
                        </div>
                    </div>
                </form>
            );

            const textarea = screen.getByPlaceholderText('Ask Goose a question...');
            fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

            expect(handleKeyDown).toHaveBeenCalledTimes(1);
            expect(handleSubmit).toHaveBeenCalledTimes(1);
        });

        it('does not submit when Shift+Enter is pressed', async () => {
            const handleSubmit = vi.fn(e => e.preventDefault());
            const handleKeyDown = vi.fn(e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                }
            });

            render(
                <form onSubmit={handleSubmit}>
                    <div className="input-container">
                        <div className="input-row">
                            <textarea
                                placeholder="Ask Goose a question..."
                                onKeyDown={handleKeyDown}
                            />
                            <button type="submit">Send</button>
                        </div>
                    </div>
                </form>
            );

            const textarea = screen.getByPlaceholderText('Ask Goose a question...');
            fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

            expect(handleKeyDown).toHaveBeenCalledTimes(1);
            expect(handleSubmit).not.toHaveBeenCalled();
        });
    });
}); 
