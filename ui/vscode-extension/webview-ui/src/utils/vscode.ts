import { VSCodeAPI } from '../types';

declare global {
    interface Window {
        acquireVsCodeApi: () => VSCodeAPI;
    }
}

// Singleton pattern for VS Code API
let vscodeApi: VSCodeAPI | undefined = undefined;

export const getVSCodeAPI = (): VSCodeAPI => {
    if (!vscodeApi) {
        vscodeApi = window.acquireVsCodeApi();
    }
    return vscodeApi;
}; 
