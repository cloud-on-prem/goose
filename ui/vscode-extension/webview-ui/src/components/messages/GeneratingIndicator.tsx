import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface GeneratingIndicatorProps {
    onStop: () => void;
    intermediateContent: string | null;
}

const GeneratingIndicator: React.FC<GeneratingIndicatorProps> = ({
    onStop,
    intermediateContent = null
}) => {
    return (
        <div className="generating-container">
            {intermediateContent && (
                <div className="intermediate-text">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ _node, inline, className, children, ...props }: {
                                _node?: any;
                                inline?: boolean;
                                className?: string;
                                children: React.ReactNode;
                            }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const lang = match ? match[1] : '';

                                if (!inline) {
                                    return (
                                        <SyntaxHighlighter
                                            style={{
                                                ...vscDarkPlus,
                                                'pre[class*="language-"]': {
                                                    background: 'var(--vscode-textCodeBlock-background)',
                                                    margin: '1em 0',
                                                    padding: '1em',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--vscode-widget-border)'
                                                },
                                                'code[class*="language-"]': {
                                                    background: 'var(--vscode-textCodeBlock-background)',
                                                    padding: '0',
                                                    fontFamily: 'var(--vscode-editor-font-family)',
                                                    fontSize: 'var(--vscode-editor-font-size)'
                                                }
                                            }}
                                            language={lang || 'text'}
                                            PreTag="div"
                                            wrapLongLines={true}
                                            customStyle={{
                                                margin: '1em 0',
                                                padding: '0',
                                                width: '100%',
                                                overflow: 'auto'
                                            }}
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    );
                                }

                                return (
                                    <code
                                        className={`inline-code ${className || ''}`}
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                );
                            }
                        }}
                    >
                        {intermediateContent}
                    </ReactMarkdown>
                </div>
            )}
            <div className="generating-indicator">
                <div className="dot-pulse"></div>
                <span>Generating...</span>
                <button
                    className="stop-generation-button"
                    onClick={onStop}
                    title="Stop generation"
                >
                    Stop
                </button>
            </div>
        </div>
    );
};

export default GeneratingIndicator; 
