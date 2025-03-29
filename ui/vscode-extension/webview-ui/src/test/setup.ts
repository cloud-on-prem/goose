import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock the VS Code API
window.acquireVsCodeApi = vi.fn(() => ({
    postMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn(),
}));

// Mock the VSCode module
vi.mock('../vscode', () => ({
    vscode: {
        postMessage: vi.fn(),
    },
})); 
