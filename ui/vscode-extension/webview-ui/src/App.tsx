import React, { useEffect } from 'react';

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

// Acquire VS Code API
const vscode = window.acquireVsCodeApi();

const App: React.FC = () => {
    useEffect(() => {
        // Listen for messages from the extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            // Handle the message
            console.log('Received message from extension:', message);
        };

        window.addEventListener('message', handleMessage);

        // Clean up event listener
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Send a message to the extension
    const sendMessage = () => {
        vscode.postMessage({
            command: 'hello',
            text: 'Hello from the webview!'
        });
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Goose Wingman</h1>
            <p className="mb-4">Welcome to Goose Wingman, your AI assistant in VS Code!</p>
            <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                onClick={sendMessage}
            >
                Send Message to Extension
            </button>
        </div>
    );
};

export default App; 
