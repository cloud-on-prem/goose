// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Message types for communication between extension and webview
enum MessageType {
	HELLO = 'hello',
	GET_ACTIVE_EDITOR_CONTENT = 'getActiveEditorContent',
	ACTIVE_EDITOR_CONTENT = 'activeEditorContent',
	ERROR = 'error'
}

// Interface for messages sent between extension and webview
interface Message {
	command: string;
	[key: string]: any; // Additional properties
}

/**
 * Manages webview panels
 */
class WebviewPanel {
	public static currentPanel: WebviewPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (WebviewPanel.currentPanel) {
			WebviewPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			'gooseWingman',
			'Goose Wingman',
			column || vscode.ViewColumn.One,
			{
				// Enable scripts in the webview
				enableScripts: true,
				// Restrict the webview to only load resources from the `out` directory
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'out'),
					vscode.Uri.joinPath(extensionUri, 'webview-ui/dist')
				],
				retainContextWhenHidden: true,
			}
		);

		WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			(message: Message) => {
				this._handleMessage(message);
			},
			null,
			this._disposables
		);
	}

	private _handleMessage(message: Message) {
		switch (message.command) {
			case MessageType.HELLO:
				vscode.window.showInformationMessage(message.text);
				break;

			case MessageType.GET_ACTIVE_EDITOR_CONTENT:
				this._sendActiveEditorContent();
				break;

			default:
				console.log(`Unhandled message command: ${message.command}`);
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

	private _sendMessageToWebview(message: Message) {
		this._panel.webview.postMessage(message);
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = "Goose Wingman";
		this._panel.webview.html = this._getHtmlForWebview(webview);
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

	public dispose() {
		WebviewPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "goose-vscode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloDisposable = vscode.commands.registerCommand('goose-wingman.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Goose Wingman!');
	});

	const startDisposable = vscode.commands.registerCommand('goose-wingman.start', () => {
		WebviewPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(helloDisposable, startDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
