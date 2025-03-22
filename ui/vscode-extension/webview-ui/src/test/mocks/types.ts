// Mock MessageType enum
export enum MessageType {
    HELLO = 'hello',
    GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
    ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
    ERROR = 'error',
    SERVER_STATUS = 'serverStatus',
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
    GET_SESSIONS = 'getSessions'
}

// Content types
export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    url: string;
}

export type MessageContent = TextContent | ImageContent;

// Message interface
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    created: number;
    content: MessageContent[];
}

// Code reference interface
export interface CodeReference {
    id: string;
    filePath: string;
    fileName: string;
    startLine: number;
    endLine: number;
    selectedText: string;
    languageId: string;
}

// Session interface
export interface SessionMetadata {
    id: string;
    metadata: {
        title: string;
        timestamp: number;
        lastUpdated: number;
    };
}

// Workspace context interface
export interface WorkspaceContext {
    currentLanguage?: string;
    projectType?: string;
    currentFile?: string;
    currentFilePath?: string;
    diagnostics?: any[];
    recentFiles?: string[];
    openFiles?: string[];
} 
