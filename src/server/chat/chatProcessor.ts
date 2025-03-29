    private async sendChatRequest(): Promise < Response > {
    // Create abort controller for cancellation
    this.abortController = new AbortController();

    if(!this.serverManager.isReady()) {
    throw new Error('Server is not ready');
}

const apiClient = this.serverManager.getApiClient();
if (!apiClient) {
    throw new Error('API client is not available');
}

// Get the current workspace directory
let workingDir = process.cwd();

// If VSCode has an active workspace folder, use that instead
const workspaceFolders = vscode.workspace.workspaceFolders;
if (workspaceFolders && workspaceFolders.length > 0) {
    workingDir = workspaceFolders[0].uri.fsPath;
}

// Use the API client to make the request with proper authentication
return await apiClient.streamChatResponse(
    this.currentMessages,
    this.abortController,
    undefined, // No session ID for now
    workingDir
);
    }

    /**
     * Send a message to the Goose server
     * @param text The text to send
     */
    public async sendMessage(text: string): Promise < void> {
    if(!this.serverManager.isReady()) {
    throw new Error('Server is not ready');
}

// Create a user message and emit it
const userMessage = createUserMessage(text);
this.emit(ChatEvents.MESSAGE_RECEIVED, userMessage);

// Add the message to our current messages
this.currentMessages = [...this.currentMessages, userMessage];

try {
    // Reset for new completion
    this.shouldStop = false;

    // Generate a unique ID for this assistant message to track it through updates
    const assistantMessageId = `assistant-${Date.now()}`;

    // Create an initial assistant message with loading state
    const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        created: Math.floor(Date.now() / 1000),
        content: [{ type: 'text', text: '' }]
    };

    // Emit the initial empty assistant message
    this.emit(ChatEvents.MESSAGE_RECEIVED, assistantMessage);

    // Set up the fetch request for SSE
    const response = await this.sendChatRequest();

    // Process the message stream
    await this.processMessageStream(response);

} catch (error) {
    console.error('Error in chat completion:', error);
    this.emit(ChatEvents.ERROR, error instanceof Error ? error : new Error(String(error)));
}
    } 
} 
