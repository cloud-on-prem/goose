// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerManager, ServerStatus, ServerEvents } from './server/serverManager';
import { ChatProcessor, ChatEvents } from './server/chat/chatProcessor';
import { Message, getTextContent } from './shared/types';

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
	STOP_GENERATION = 'stopGeneration'
}

// Interface for messages sent between extension and webview
interface WebviewMessage {
	command: string;
	[key: string]: any; // Additional properties
}

/**
 * Manages webview panels and sidebar view
 */
class GooseWingmanViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'goose-wingman.chatView';
	private _view?: vscode.WebviewView;
	private readonly _extensionUri: vscode.Uri;
	private readonly _serverManager: ServerManager;
	private readonly _chatProcessor: ChatProcessor;

	constructor(extensionUri: vscode.Uri, serverManager: ServerManager, chatProcessor: ChatProcessor) {
		this._extensionUri = extensionUri;
		this._serverManager = serverManager;
		this._chatProcessor = chatProcessor;
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
			await this._handleMessage(message);
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

		// Send initial server status
		this._sendMessageToWebview({
			command: MessageType.SERVER_STATUS,
			status: this._serverManager.getStatus()
		});

		// Log that the view has been resolved
		console.log(`Webview view resolved with context: ${context.state}`);
	}

	private async _handleMessage(message: WebviewMessage) {
		switch (message.command) {
			case MessageType.HELLO:
				vscode.window.showInformationMessage(message.text);
				break;

			case MessageType.GET_ACTIVE_EDITOR_CONTENT:
				this._sendActiveEditorContent();
				break;

			case MessageType.SEND_CHAT_MESSAGE:
				this._handleChatMessage(message.text);
				break;

			case MessageType.STOP_GENERATION:
				this._chatProcessor.stop();
				break;

			default:
				console.log(`Unhandled message command: ${message.command}`);
		}
	}

	private _handleChatMessage(text: string) {
		this._chatProcessor.sendMessage(text).catch(error => {
			console.error('Error handling chat message:', error);
			this._sendMessageToWebview({
				command: MessageType.ERROR,
				errorMessage: error.message
			});
		});
	}

	private _sendMessageToWebview(message: any) {
		if (this._view) {
			this._view.webview.postMessage(message);
		}
	}

	private _sendActiveEditorContent() {
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
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Congratulations, your extension "goose-vscode" is now active!');

	// Create server manager and chat processor
	const serverManager = new ServerManager(context);
	const chatProcessor = new ChatProcessor(serverManager);

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

	// Register the Goose Wingman View Provider
	const provider = new GooseWingmanViewProvider(context.extensionUri, serverManager, chatProcessor);
	const viewRegistration = vscode.window.registerWebviewViewProvider(
		GooseWingmanViewProvider.viewType,
		provider,
		{
			webviewOptions: { retainContextWhenHidden: true }
		}
	);

	// The command has been defined in the package.json file
	const helloDisposable = vscode.commands.registerCommand('goose-wingman.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Goose Wingman!');
	});

	// Command to focus the Wingman view
	const startDisposable = vscode.commands.registerCommand('goose-wingman.start', () => {
		vscode.commands.executeCommand('goose-wingman.chatView.focus');
	});

	// Command to manually start the server
	const startServerDisposable = vscode.commands.registerCommand('goose-wingman.startServer', async () => {
		try {
			vscode.window.showInformationMessage('Starting Goose server...');
			await serverManager.start();
			vscode.window.showInformationMessage('Goose server started successfully');
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to start Goose server: ${error}`);
		}
	});

	// Command to manually stop the server
	const stopServerDisposable = vscode.commands.registerCommand('goose-wingman.stopServer', () => {
		try {
			serverManager.stop();
			vscode.window.showInformationMessage('Goose server stopped');
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to stop Goose server: ${error}`);
		}
	});

	context.subscriptions.push(
		viewRegistration,
		helloDisposable,
		startDisposable,
		startServerDisposable,
		stopServerDisposable
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
