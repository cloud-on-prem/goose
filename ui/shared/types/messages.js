"use strict";
/**
 * Message types that match the Rust message structures
 * for direct serialization between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserMessage = createUserMessage;
exports.createAssistantMessage = createAssistantMessage;
exports.createToolRequestMessage = createToolRequestMessage;
exports.createToolResponseMessage = createToolResponseMessage;
exports.createToolErrorResponseMessage = createToolErrorResponseMessage;
exports.getTextContent = getTextContent;
exports.getToolRequests = getToolRequests;
exports.getToolResponses = getToolResponses;
exports.getToolConfirmationContent = getToolConfirmationContent;
exports.hasCompletedToolCalls = hasCompletedToolCalls;
// Helper functions to create messages
function createUserMessage(text) {
    return {
        id: generateId(),
        role: 'user',
        created: Math.floor(Date.now() / 1000),
        content: [{ type: 'text', text }],
    };
}
function createAssistantMessage(text) {
    return {
        id: generateId(),
        role: 'assistant',
        created: Math.floor(Date.now() / 1000),
        content: [{ type: 'text', text }],
    };
}
function createToolRequestMessage(id, toolName, args) {
    return {
        id: generateId(),
        role: 'assistant',
        created: Math.floor(Date.now() / 1000),
        content: [
            {
                type: 'toolRequest',
                id,
                toolCall: {
                    status: 'success',
                    value: {
                        name: toolName,
                        arguments: args,
                    },
                },
            },
        ],
    };
}
function createToolResponseMessage(id, result) {
    return {
        id: generateId(),
        role: 'user',
        created: Math.floor(Date.now() / 1000),
        content: [
            {
                type: 'toolResponse',
                id,
                toolResult: {
                    status: 'success',
                    value: result,
                },
            },
        ],
    };
}
function createToolErrorResponseMessage(id, error) {
    return {
        id: generateId(),
        role: 'user',
        created: Math.floor(Date.now() / 1000),
        content: [
            {
                type: 'toolResponse',
                id,
                toolResult: {
                    status: 'error',
                    error,
                },
            },
        ],
    };
}
// Generate a unique ID for messages
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}
// Helper functions to extract content from messages
function getTextContent(message) {
    return message.content
        .filter((content) => content.type === 'text')
        .map((content) => content.text)
        .join('\n');
}
function getToolRequests(message) {
    return message.content.filter((content) => content.type === 'toolRequest');
}
function getToolResponses(message) {
    return message.content.filter((content) => content.type === 'toolResponse');
}
function getToolConfirmationContent(message) {
    return message.content.find((content) => content.type === 'toolConfirmationRequest');
}
function hasCompletedToolCalls(message) {
    const toolRequests = getToolRequests(message);
    if (toolRequests.length === 0)
        return false;
    // For now, we'll assume all tool calls are completed when this is checked
    // In a real implementation, you'd need to check if all tool requests have responses
    // by looking through subsequent messages
    return true;
}
//# sourceMappingURL=messages.js.map