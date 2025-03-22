// Mock MessageType enum
export enum MessageType {
    HELLO = 'hello',
    GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
    ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
    ERROR = 'error',
    SERVER_STATUS = 'serverStatus',
    CHAT_MESSAGE = 'chatMessage',
    SEND_CHAT_MESSAGE = 'sendChatMessage',
    RECEIVE_CHAT_MESSAGE = 'receiveChatMessage',
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
    // Add streaming message types
    RECEIVE_STREAM_START = 'receiveStreamStart',
    RECEIVE_STREAM_CHUNK = 'receiveStreamChunk',
    RECEIVE_STREAM_END = 'receiveStreamEnd',
    // Add session update types
    RECEIVE_MESSAGE_UPDATE = 'receiveMessageUpdate',
    RECEIVE_SESSIONS_UPDATE = 'receiveSessionsUpdate'
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

// Session interface with messages
export interface Session {
    id: string;
    name: string;
    messages: Message[];
    createdAt: number;
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
