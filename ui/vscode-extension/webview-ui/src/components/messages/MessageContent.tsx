import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MessageContent as MessageContentType } from '../../types';

interface MessageContentProps {
    content: MessageContentType[];
}

export const MessageContentRenderer: React.FC<MessageContentProps> = ({ content }) => {
    // If content array is empty or null/undefined, show a placeholder
    if (!content || content.length === 0) {
        return (
            <div className="message-text empty-message">
                <i>Empty response. Waiting for content...</i>
            </div>
        );
    }

    // Create a filtered array of valid content items
    const validItems = content.filter(item => {
        // First check if item exists
        if (!item) {
            return false;
        }

        // Check if it's a text item (most common)
        if (item.type === 'text') {
            // Allow even empty strings during generation
            return typeof item.text === 'string';
        }

        // Other content types might be valid, keep them
        return true;
    });

    // If we have no valid items after filtering, show the fallback
    if (validItems.length === 0) {
        return (
            <div className="message-text empty-message">
                <i>Waiting for response content...</i>
            </div>
        );
    }

    // Map valid content items to components
    return (
        <>
            {validItems.map((item, index) => {
                if (item.type === 'text') {
                    // If the text is empty, show generating message
                    if (!item.text || item.text.trim() === '') {
                        return (
                            <div key={index} className="message-text empty-message">
                                <i>Generating content...</i>
                            </div>
                        );
                    }

                    // Check if the content appears to be JSON data that needs parsing
                    let textContent = item.text;
                    if (typeof textContent === 'string' && textContent.trim().startsWith('data:')) {
                        try {
                            // Extract the JSON part
                            const jsonMatch = textContent.match(/data:\s*(\{.*\})/);
                            if (jsonMatch && jsonMatch[1]) {
                                const jsonData = JSON.parse(jsonMatch[1]);
                                if (jsonData.message && typeof jsonData.message === 'string') {
                                    textContent = jsonData.message;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing JSON in message:', e);
                        }
                    }

                    return (
                        <div key={index} className="message-text">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // Custom code block rendering with syntax highlighting
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

                                        // For inline code, use the VSCode theme variables directly
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
                                {textContent}
                            </ReactMarkdown>
                        </div>
                    );
                } else if (item.type === 'image' && 'url' in item) {
                    return (
                        <div key={index} className="message-image">
                            <img src={item.url} alt="Generated" />
                        </div>
                    );
                }
                return null;
            })}
        </>
    );
}; 
