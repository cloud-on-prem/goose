import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkspaceContext {
    currentLanguage?: string;
    projectType?: string;
    currentFile?: string;
    currentFilePath?: string;
    diagnostics?: vscode.Diagnostic[];
    recentFiles?: string[];
    openFiles?: string[];
}

export class WorkspaceContextProvider {
    private static instance: WorkspaceContextProvider;
    private recentFiles: string[] = [];
    private maxRecentFiles = 5;

    private constructor() {
        // Track recently viewed files
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.uri.scheme === 'file') {
                const filePath = editor.document.uri.fsPath;
                // Remove it if it's already in the list
                this.recentFiles = this.recentFiles.filter(f => f !== filePath);
                // Add it to the start of the list
                this.recentFiles.unshift(filePath);
                // Keep only maxRecentFiles
                if (this.recentFiles.length > this.maxRecentFiles) {
                    this.recentFiles.pop();
                }
            }
        });
    }

    public static getInstance(): WorkspaceContextProvider {
        if (!WorkspaceContextProvider.instance) {
            WorkspaceContextProvider.instance = new WorkspaceContextProvider();
        }
        return WorkspaceContextProvider.instance;
    }

    /**
     * Get the current language of the active editor
     */
    public getCurrentLanguage(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        return editor?.document.languageId;
    }

    /**
     * Get the current file name
     */
    public getCurrentFileName(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        return path.basename(editor.document.uri.fsPath);
    }

    /**
     * Get the current file path
     */
    public getCurrentFilePath(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        return editor.document.uri.fsPath;
    }

    /**
     * Get current diagnostics (errors/warnings) for the active editor
     */
    public getCurrentDiagnostics(): vscode.Diagnostic[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }

        return vscode.languages.getDiagnostics(editor.document.uri);
    }

    /**
     * Get a list of open files
     */
    public getOpenFiles(): string[] {
        return vscode.workspace.textDocuments
            .filter(doc => doc.uri.scheme === 'file')
            .map(doc => doc.uri.fsPath);
    }

    /**
     * Get recently viewed files
     */
    public getRecentFiles(): string[] {
        return [...this.recentFiles];
    }

    /**
     * Get project type based on configuration files
     */
    public async getProjectType(): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return "unknown";
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        // Check for common project configuration files
        const configFiles = [
            { file: 'package.json', type: 'node' },
            { file: 'cargo.toml', type: 'rust' },
            { file: 'pom.xml', type: 'java' },
            { file: 'requirements.txt', type: 'python' },
            { file: 'Gemfile', type: 'ruby' },
            { file: 'CMakeLists.txt', type: 'cpp' },
            { file: 'go.mod', type: 'go' },
            { file: 'Cargo.toml', type: 'rust' }
        ];

        for (const config of configFiles) {
            const configPath = path.join(rootPath, config.file);
            try {
                if (fs.existsSync(configPath)) {
                    return config.type;
                }
            } catch (error) {
                console.error(`Error checking for ${config.file}:`, error);
            }
        }

        return "unknown";
    }

    /**
     * Get complete context information
     */
    public async getContext(): Promise<WorkspaceContext> {
        return {
            currentLanguage: this.getCurrentLanguage(),
            projectType: await this.getProjectType(),
            currentFile: this.getCurrentFileName(),
            currentFilePath: this.getCurrentFilePath(),
            diagnostics: this.getCurrentDiagnostics(),
            recentFiles: this.getRecentFiles(),
            openFiles: this.getOpenFiles()
        };
    }

    /**
     * Format diagnostics as a string
     */
    public formatDiagnostics(diagnostics: vscode.Diagnostic[]): string {
        if (!diagnostics || diagnostics.length === 0) {
            return "No diagnostics found";
        }

        return diagnostics.map(diag => {
            const severity = this.getSeverityString(diag.severity);
            const location = `Line ${diag.range.start.line + 1}, Column ${diag.range.start.character + 1}`;
            return `${severity} at ${location}: ${diag.message}`;
        }).join('\n');
    }

    private getSeverityString(severity: vscode.DiagnosticSeverity): string {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'Error';
            case vscode.DiagnosticSeverity.Warning:
                return 'Warning';
            case vscode.DiagnosticSeverity.Information:
                return 'Info';
            case vscode.DiagnosticSeverity.Hint:
                return 'Hint';
            default:
                return 'Unknown';
        }
    }
} 
