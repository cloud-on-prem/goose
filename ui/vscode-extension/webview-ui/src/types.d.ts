declare module 'react-syntax-highlighter';
declare module 'react-syntax-highlighter/dist/esm/styles/prism';

export enum MessageType {
    HELLO = 'hello',
    CHAT_RESPONSE = 'chatResponse',
    AI_MESSAGE = 'aiMessage',
    SERVER_STATUS = 'serverStatus',
    SERVER_EXIT = 'serverExit',
    GENERATION_FINISHED = 'generationFinished',
    WORKSPACE_CONTEXT = 'workspaceContext',
    ERROR = 'error',
    SEND_CHAT_MESSAGE = 'sendChatMessage',
    STOP_GENERATION = 'stopGeneration',
    GET_WORKSPACE_CONTEXT = 'getWorkspaceContext',
    GET_SERVER_STATUS = 'getServerStatus',
    ADD_CODE_REFERENCE = 'addCodeReference',
    CODE_REFERENCE = 'codeReference',
    REMOVE_CODE_REFERENCE = 'removeCodeReference',
    SESSION_LOADED = 'sessionLoaded'
} 
