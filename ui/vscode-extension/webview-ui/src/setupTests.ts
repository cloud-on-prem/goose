import { vi, expect } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock CSS imports
vi.mock('*.css', () => ({}));

// Mock the VSCode API
vi.mock('../utils/vscode', () => ({
    getVSCodeAPI: vi.fn().mockReturnValue({
        postMessage: vi.fn(),
        getState: vi.fn().mockReturnValue({}),
        setState: vi.fn()
    })
})); 
