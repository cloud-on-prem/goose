import React, { useEffect, useState } from 'react';

// VS Code API is available as a global when running in a webview
declare global {
    interface Window {
        acquireVsCodeApi: () => {
            postMessage: (message: any) => void;
            getState: () => any;
            setState: (state: any) => void;
        };
    }
}

// Message types for communication with the extension
enum MessageType {
    HELLO = 'hello',
    GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
    ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
    ERROR = 'error'
}

// Acquire VS Code API
const vscode = window.acquireVsCodeApi();

const App: React.FC = () => {
    const [editorContent, setEditorContent] = useState<string | null>(null);
    const [editorFile, setEditorFile] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        // Listen for messages from the extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Received message from extension:', message);

            switch (message.command) {
                case MessageType.ACTIVE_EDITOR_CONTENT:
                    setEditorContent(message.content);
                    setEditorFile(message.fileName);
                    setErrorMessage(null);
                    break;
                case MessageType.ERROR:
                    setErrorMessage(message.errorMessage);
                    break;
                default:
                    console.log(`Unhandled message type: ${message.command}`);
            }
        };

        window.addEventListener('message', handleMessage);

        // Clean up event listener
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Send a hello message to the extension
    const sendHelloMessage = () => {
        vscode.postMessage({
            command: MessageType.HELLO,
            text: 'Hello from the webview!'
        });
    };

    // Request active editor content
    const getActiveEditorContent = () => {
        vscode.postMessage({
            command: MessageType.GET_ACTIVE_EDITOR_CONTENT
        });
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Goose Wingman</h1>
            <p className="mb-4">Welcome to Goose Wingman, your AI assistant in VS Code!</p>

            <div className="space-x-2 mb-4">
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={sendHelloMessage}
                >
                    Send Hello Message
                </button>

                <button
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    onClick={getActiveEditorContent}
                >
                    Get Editor Content
                </button>
            </div>

            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    Error: {errorMessage}
                </div>
            )}

            {editorContent && (
                <div className="mt-4">
                    <h2 className="text-xl font-semibold mb-2">Editor Content:</h2>
                    <p className="text-sm text-gray-600 mb-2">{editorFile}</p>
                    <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                        <pre>{editorContent}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App; 
