import * as assert from 'assert';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { ServerManager, ServerStatus, ServerEvents } from '../../server/serverManager';
import * as binaryPath from '../../utils/binaryPath';
import * as vscode from 'vscode';
import * as gooseServer from '../../shared/server/gooseServer';

suite('ServerManager Tests', () => {
    let serverManager: ServerManager;
    let mockContext: Partial<vscode.ExtensionContext>;
    let sandbox: sinon.SinonSandbox;
    let startGoosedStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock the VSCode extension context
        mockContext = {
            subscriptions: [],
            extensionPath: '/test/extension',
            extensionUri: {} as vscode.Uri,
            asAbsolutePath: (path: string) => `/test/extension/${path}`,
            storageUri: undefined,
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub(),
                setKeysForSync: sandbox.stub()
            } as unknown as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
            workspaceState: {} as vscode.Memento,
            secrets: {} as vscode.SecretStorage,
            extensionMode: vscode.ExtensionMode.Development,
            globalStorageUri: {} as vscode.Uri,
            logUri: {} as vscode.Uri,
            logPath: '/test/extension/logs'
        };

        // Mock the binaryPath.getBinaryPath function
        sandbox.stub(binaryPath, 'getBinaryPath').returns('/test/bin/goosed');

        // Mock the startGoosed function
        startGoosedStub = sandbox.stub(gooseServer, 'startGoosed');
        startGoosedStub.resolves({
            port: 8000,
            workingDir: '/test/dir',
            process: {
                kill: sandbox.stub(),
                pid: 12345
            } as any,
            secretKey: 'test-secret-key'
        });

        // Create the server manager
        serverManager = new ServerManager(mockContext as vscode.ExtensionContext);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should have stopped status initially', () => {
        assert.strictEqual(serverManager.getStatus(), ServerStatus.STOPPED);
    });

    test('should emit status change events', async () => {
        const statusChangeListener = sandbox.spy();

        serverManager.on(ServerEvents.STATUS_CHANGE, statusChangeListener);

        // Start the server
        await serverManager.start();

        // Verify status change events were emitted
        sinon.assert.calledWith(statusChangeListener, ServerStatus.STARTING);
        sinon.assert.calledWith(statusChangeListener, ServerStatus.RUNNING);
    });

    test('should create API client when server starts', async () => {
        await serverManager.start();

        // API client should be created
        const apiClient = serverManager.getApiClient();
        assert.notStrictEqual(apiClient, null);
    });

    test('should return server port after started', async () => {
        await serverManager.start();

        // Port should be set
        const port = serverManager.getPort();
        assert.strictEqual(port, 8000);
    });

    test('should handle errors during server start', async () => {
        // Mock startGoosed to throw an error
        startGoosedStub.rejects(new Error('Test error'));

        // Spy on error events
        const errorListener = sandbox.spy();
        serverManager.on(ServerEvents.ERROR, errorListener);

        // Attempt to start server
        const result = await serverManager.start();

        // Start should fail
        assert.strictEqual(result, false);

        // Status should be error
        assert.strictEqual(serverManager.getStatus(), ServerStatus.ERROR);

        // Error event should be emitted
        sinon.assert.called(errorListener);
    });
}); 
