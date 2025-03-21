import * as vscode from 'vscode';

/**
 * Provides code actions for diagnostics and selected code
 */
export class GooseCodeActionProvider implements vscode.CodeActionProvider {
    /**
     * Provide code actions for the given document and range.
     */
    public provideCodeActions(
        _document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const actions: vscode.CodeAction[] = [];

        // Create actions based on diagnostics
        if (context.diagnostics.length > 0) {
            // Group actions by diagnostic to avoid duplicates
            const diagnosticsMap = new Map<string, vscode.Diagnostic>();

            // Only include one action per unique diagnostic message
            for (const diagnostic of context.diagnostics) {
                const key = `${diagnostic.message}:${diagnostic.range.start.line}`;
                if (!diagnosticsMap.has(key)) {
                    diagnosticsMap.set(key, diagnostic);
                }
            }

            // Create an action for each unique diagnostic
            for (const [_, diagnostic] of diagnosticsMap) {
                const action = this.createDiagnosticAction(diagnostic);
                if (action) {
                    actions.push(action);
                }
            }
        }

        // Add general improvement actions if there's a selection
        if (!range.isEmpty) {
            actions.push(this.createGeneralAction(
                'Explain with Goose',
                'goose.explainCode',
                vscode.CodeActionKind.QuickFix
            ));

            actions.push(this.createGeneralAction(
                'Optimize with Goose',
                'goose.optimizeCode',
                vscode.CodeActionKind.RefactorRewrite
            ));

            actions.push(this.createGeneralAction(
                'Generate tests with Goose',
                'goose.generateTests',
                vscode.CodeActionKind.RefactorRewrite
            ));

            actions.push(this.createGeneralAction(
                'Document with Goose',
                'goose.documentCode',
                vscode.CodeActionKind.RefactorRewrite
            ));
        }

        return actions;
    }

    /**
     * Create an action for a diagnostic
     */
    private createDiagnosticAction(
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | null {
        const action = new vscode.CodeAction(
            `Fix with Goose: ${this.trimDiagnosticMessage(diagnostic.message)}`,
            vscode.CodeActionKind.QuickFix
        );

        action.command = {
            title: 'Fix with Goose',
            command: 'goose.fixIssues'
        };

        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        return action;
    }

    /**
     * Create a general action for selected code
     */
    private createGeneralAction(
        title: string,
        command: string,
        kind: vscode.CodeActionKind
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(title, kind);

        action.command = {
            title,
            command
        };

        return action;
    }

    /**
     * Trim a diagnostic message to a reasonable length for display
     */
    private trimDiagnosticMessage(message: string): string {
        const maxLength = 50;
        if (message.length <= maxLength) {
            return message;
        }

        return message.substring(0, maxLength - 3) + '...';
    }
} 
