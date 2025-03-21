// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerManager, ServerStatus, ServerEvents } from './server/serverManager';
import { ChatProcessor, ChatEvents } from './server/chat/chatProcessor';
import { Message, getTextContent } from './shared/types';
import { CodeReferenceManager, CodeReference } from './utils/codeReferenceManager';
import { WorkspaceContextProvider } from './utils/workspaceContextProvider';
import { GooseCodeActionProvider } from './utils/codeActionProvider';

// Message types for communication between extension and webview
enum MessageType {
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
	WORKSPACE_CONTEXT = 'workspaceContext'
}

// Interface for messages sent between extension and webview
interface WebviewMessage {
	command: string;
	[key: string]: any; // Additional properties
}

/**
 * Manages webview panels and sidebar view
 */
class GooseViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'goose.chatView';
	private _view?: vscode.WebviewView;
	private readonly _extensionUri: vscode.Uri;
	private readonly _serverManager: ServerManager;
	private readonly _chatProcessor: ChatProcessor;
	private readonly _codeReferenceManager: CodeReferenceManager;
	private readonly _workspaceContextProvider: WorkspaceContextProvider;

	constructor(extensionUri: vscode.Uri, serverManager: ServerManager, chatProcessor: ChatProcessor) {
		this._extensionUri = extensionUri;
		this._serverManager = serverManager;
		this._chatProcessor = chatProcessor;
		this._codeReferenceManager = CodeReferenceManager.getInstance();
		this._workspaceContextProvider = WorkspaceContextProvider.getInstance();
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Enable scripts in the webview
			enableScripts: true,
			// Restrict the webview to only load resources from the `out` directory
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'out'),
				vscode.Uri.joinPath(this._extensionUri, 'webview-ui/dist')
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			console.log(`Received message from webview: ${JSON.stringify(message)}`);
			await this._onDidReceiveMessage(message);
		});

		// Set up event listeners for server status changes
		this._serverManager.on(ServerEvents.STATUS_CHANGE, (status: ServerStatus) => {
			this._sendMessageToWebview({
				command: MessageType.SERVER_STATUS,
				status
			});
		});

		// Set up event listeners for chat events
		this._chatProcessor.on(ChatEvents.MESSAGE_RECEIVED, (message: Message) => {
			this._sendMessageToWebview({
				command: MessageType.AI_MESSAGE,
				message
			});
		});

		this._chatProcessor.on(ChatEvents.ERROR, (error: Error) => {
			this._sendMessageToWebview({
				command: MessageType.ERROR,
				errorMessage: error.message
			});
		});

		this._chatProcessor.on(ChatEvents.FINISH, (message: Message, reason: string) => {
			this._sendMessageToWebview({
				command: MessageType.GENERATION_FINISHED,
				message,
				reason
			});
		});

		// Send initial server status
		this._sendMessageToWebview({
			command: MessageType.SERVER_STATUS,
			status: this._serverManager.getStatus()
		});

		// Log that the view has been resolved
		console.log(`Webview view resolved with context: ${context.state}`);
	}

	private async _onDidReceiveMessage(message: any) {
		console.log('Received message from webview:', message);

		switch (message.command) {
			case MessageType.HELLO:
				console.log('Hello from webview!');
				break;

			case MessageType.GET_ACTIVE_EDITOR_CONTENT:
				this._getActiveEditorContent();
				break;

			case MessageType.SEND_CHAT_MESSAGE:
				if (message.text.trim() || (message.codeReferences && message.codeReferences.length > 0)) {
					// Only process if there's actual content or code references
					try {
						// Pass the messageId along to the chat processor
						await this._chatProcessor.sendMessage(
							message.text,
							message.codeReferences,
							message.messageId
						);
					} catch (error) {
						console.error('Error sending message to chat processor:', error);
						this._sendMessageToWebview({
							command: MessageType.ERROR,
							errorMessage: error instanceof Error ? error.message : String(error)
						});
					}
				}
				break;

			case MessageType.STOP_GENERATION:
				this._chatProcessor.stopGeneration();
				break;

			case MessageType.GET_WORKSPACE_CONTEXT:
				this._sendWorkspaceContext();
				break;

			default:
				console.log(`Unhandled message: ${message.command}`);
		}
	}

	private _getActiveEditorContent() {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const content = document.getText();
			const fileName = document.fileName;
			const languageId = document.languageId;

			this._sendMessageToWebview({
				command: MessageType.ACTIVE_EDITOR_CONTENT,
				content,
				fileName,
				languageId,
			});
		} else {
			this._sendMessageToWebview({
				command: MessageType.ERROR,
				errorMessage: 'No active editor found'
			});
		}
	}

	/**
	 * Sends a message to the webview
	 */
	public _sendMessageToWebview(message: any) {
		this.sendMessageToWebview(message);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Path to the built webview UI
		const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');
		const webviewDistPath = webview.asWebviewUri(distPath);

		// Get paths to CSS and JS files
		const indexPath = path.join(this._extensionUri.fsPath, 'webview-ui', 'dist', 'index.html');

		// Read the file
		let indexHtml = fs.readFileSync(indexPath, 'utf8');

		// Update the asset paths to be webview-friendly
		indexHtml = indexHtml.replace(
			/(href|src)="([^"]*)"/g,
			(match, p1, p2) => {
				// Skip external URLs and data URLs
				if (p2.startsWith('http') || p2.startsWith('data:')) {
					return match;
				}
				return `${p1}="${webviewDistPath.toString()}/${p2}"`;
			}
		);

		return indexHtml;
	}

	/**
	 * Adds a code reference to the chat input
	 */
	public addCodeReference() {
		const codeReference = this._codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			this._sendMessageToWebview({
				command: MessageType.ADD_CODE_REFERENCE,
				codeReference
			});
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	}

	/**
	 * Sends workspace context information to the webview
	 */
	private async _sendWorkspaceContext() {
		const context = await this._workspaceContextProvider.getContext();
		this._sendMessageToWebview({
			command: MessageType.WORKSPACE_CONTEXT,
			context
		});
	}

	/**
	 * Adds the current diagnostics to the chat
	 */
	public async addCurrentDiagnostics() {
		const diagnostics = this._workspaceContextProvider.getCurrentDiagnostics();
		const formattedDiagnostics = this._workspaceContextProvider.formatDiagnostics(diagnostics);
		const currentFile = this._workspaceContextProvider.getCurrentFileName();

		if (diagnostics.length === 0) {
			this._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: `No issues found in ${currentFile || 'the current file'}.`
			});
		} else {
			this._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: `Please help me fix these issues in ${currentFile || 'my code'}:\n\n${formattedDiagnostics}`
			});
		}

		vscode.commands.executeCommand('goose.chatView.focus');
	}

	// Add event handler to confirm message was sent to webview
	public sendMessageToWebview(message: any): void {
		if (this._view && this._view.webview) {
			try {
				console.log(`Sending message to webview: ${message.command}`);
				this._view.webview.postMessage(message);
				console.log(`Successfully sent message to webview: ${message.command}`);
				if (message.command === MessageType.AI_MESSAGE && message.message && message.message.id) {
					console.log(`Sent AI message with ID: ${message.message.id}`);
				}
			} catch (error) {
				console.error('Error sending message to webview:', error);
			}
		} else {
			console.warn('Webview is not available, message not sent');
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Congratulations, your extension "goose-vscode" is now active!');

	// Create server manager, chat processor, and code reference manager
	const serverManager = new ServerManager(context);
	const chatProcessor = new ChatProcessor(serverManager);
	const codeReferenceManager = CodeReferenceManager.getInstance();
	const workspaceContextProvider = WorkspaceContextProvider.getInstance();

	// Automatically start the server when the extension activates
	serverManager.start().then(success => {
		if (success) {
			console.log('Goose server started automatically on extension activation');
		} else {
			console.error('Failed to automatically start the Goose server');
		}
	}).catch(error => {
		console.error('Error starting Goose server:', error);
	});

	// Register the Goose View Provider
	const provider = new GooseViewProvider(context.extensionUri, serverManager, chatProcessor);
	const viewRegistration = vscode.window.registerWebviewViewProvider(
		GooseViewProvider.viewType,
		provider,
		{
			webviewOptions: { retainContextWhenHidden: true }
		}
	);

	// Register code action provider
	const codeActionProvider = new GooseCodeActionProvider();
	const supportedLanguages = [
		'javascript', 'typescript', 'python', 'java', 'csharp',
		'cpp', 'c', 'rust', 'go', 'php', 'ruby', 'swift', 'kotlin',
		'html', 'css', 'markdown', 'json', 'yaml', 'plaintext'
	];

	const codeActionRegistration = vscode.languages.registerCodeActionsProvider(
		supportedLanguages.map(lang => ({ language: lang })),
		codeActionProvider
	);

	// The command has been defined in the package.json file
	const helloDisposable = vscode.commands.registerCommand('goose.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Goose!');
	});

	// Command to focus the Goose view
	const startDisposable = vscode.commands.registerCommand('goose.start', () => {
		vscode.commands.executeCommand('goose.chatView.focus');
	});

	// Command to manually start the server
	const startServerDisposable = vscode.commands.registerCommand('goose.startServer', async () => {
		try {
			vscode.window.showInformationMessage('Starting Goose server...');
			await serverManager.start();
			vscode.window.showInformationMessage('Goose server started successfully');
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to start Goose server: ${error}`);
		}
	});

	// Command to manually stop the server
	const stopServerDisposable = vscode.commands.registerCommand('goose.stopServer', () => {
		try {
			serverManager.stop();
			vscode.window.showInformationMessage('Goose server stopped');
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to stop Goose server: ${error}`);
		}
	});

	// Command to ask Goose about selected code
	const askAboutSelectionDisposable = vscode.commands.registerCommand('goose.askAboutSelection', () => {
		provider.addCodeReference();
		vscode.commands.executeCommand('goose.chatView.focus');
	});

	// Command to explain selected code
	const explainCodeDisposable = vscode.commands.registerCommand('goose.explainCode', () => {
		const codeReference = codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			provider.addCodeReference();
			// Pre-populate with an explain question
			provider._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: "Please explain what this code does:"
			});
			vscode.commands.executeCommand('goose.chatView.focus');
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	});

	// Command to generate tests for selected code
	const generateTestsDisposable = vscode.commands.registerCommand('goose.generateTests', () => {
		const codeReference = codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			provider.addCodeReference();
			// Pre-populate with a generate tests question
			provider._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: "Please generate unit tests for this code:"
			});
			vscode.commands.executeCommand('goose.chatView.focus');
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	});

	// Command to optimize selected code
	const optimizeCodeDisposable = vscode.commands.registerCommand('goose.optimizeCode', () => {
		const codeReference = codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			provider.addCodeReference();
			// Pre-populate with an optimize question
			provider._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: "Please optimize this code for better performance and readability:"
			});
			vscode.commands.executeCommand('goose.chatView.focus');
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	});

	// Command to fix issues in selected code
	const fixIssuesDisposable = vscode.commands.registerCommand('goose.fixIssues', () => {
		const codeReference = codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			provider.addCodeReference();
			// Pre-populate with a fix issues question
			provider._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: "Please help me fix any issues or bugs in this code:"
			});
			vscode.commands.executeCommand('goose.chatView.focus');
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	});

	// Command to document selected code
	const documentCodeDisposable = vscode.commands.registerCommand('goose.documentCode', () => {
		const codeReference = codeReferenceManager.getCodeReferenceFromSelection();
		if (codeReference) {
			provider.addCodeReference();
			// Pre-populate with a document question
			provider._sendMessageToWebview({
				command: MessageType.CHAT_MESSAGE,
				text: "Please generate documentation for this code:"
			});
			vscode.commands.executeCommand('goose.chatView.focus');
		} else {
			vscode.window.showInformationMessage('Please select some code first');
		}
	});

	// Command to get diagnostics from current file
	const getDiagnosticsDisposable = vscode.commands.registerCommand('goose.getDiagnostics', () => {
		provider.addCurrentDiagnostics();
	});

	context.subscriptions.push(
		viewRegistration,
		helloDisposable,
		startDisposable,
		startServerDisposable,
		stopServerDisposable,
		askAboutSelectionDisposable,
		explainCodeDisposable,
		generateTestsDisposable,
		optimizeCodeDisposable,
		fixIssuesDisposable,
		documentCodeDisposable,
		getDiagnosticsDisposable,
		codeActionRegistration
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
