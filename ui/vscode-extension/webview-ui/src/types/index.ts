// Message types for communication with the extension
export enum MessageType {
    HELLO = 'hello',
    GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
    ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
    ERROR = 'error',
    SERVER_STATUS = 'serverStatus',
    SERVER_EXIT = 'serverExit',
    CHAT_MESSAGE = 'chatMessage',
    SEND_CHAT_MESSAGE = 'sendChatMessage',
    AI_MESSAGE = 'aiMessage',
    STOP_GENERATION = 'stopGeneration',
    GENERATION_FINISHED = 'generationFinished',
    CODE_REFERENCE = 'codeReference',
    ADD_CODE_REFERENCE = 'addCodeReference',
    REMOVE_CODE_REFERENCE = 'removeCodeReference',
    GET_WORKSPACE_CONTEXT = 'getWorkspaceContext',
    WORKSPACE_CONTEXT = 'workspaceContext',
    CHAT_RESPONSE = 'chatResponse',
    SESSIONS_LIST = 'sessionsList',
    SESSION_LOADED = 'sessionLoaded',
    SWITCH_SESSION = 'switchSession',
    CREATE_SESSION = 'createSession',
    RENAME_SESSION = 'renameSession',
    DELETE_SESSION = 'deleteSession',
    GET_SESSIONS = 'getSessions',
    RESTART_SERVER = 'restartServer',
    GET_SERVER_STATUS = 'getServerStatus'
}

// Type for code references
export interface CodeReference {
    id: string;
    filePath: string;
    fileName: string;
    startLine: number;
    endLine: number;
    selectedText: string;
    languageId: string;
}

// Type for workspace context
export interface WorkspaceContext {
    currentLanguage?: string;
    projectType?: string;
    currentFile?: string;
    currentFilePath?: string;
    diagnostics?: any[];
    recentFiles?: string[];
    openFiles?: string[];
}

// VS Code API global declaration
export interface VSCodeAPI {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
}

// Re-export Message type from shared types
export type { Message } from '../../../src/shared/types';

// Export TextContent and MessageContent types
export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    url: string;
}

export interface ActionContent {
    type: 'action';
    id: string;
    label: string;
    action: string;
}

export type MessageContent = TextContent | ImageContent | ActionContent; 
