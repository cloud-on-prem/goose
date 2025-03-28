import * as assert from 'assert';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { ServerManager, ServerStatus, ServerEvents } from '../../server/serverManager';
import * as binaryPath from '../../utils/binaryPath';
import * as vscode from 'vscode';
import * as gooseServer from '../../shared/server/gooseServer';
import { ApiClient } from '../../shared/server/apiClient';

suite('ServerManager Tests', () => {
    let serverManager: ServerManager;
    let mockContext: Partial<vscode.ExtensionContext>;
    let sandbox: sinon.SinonSandbox;
    let startGoosedStub: sinon.SinonStub;
    let workspaceFoldersStub: sinon.SinonStub;
    let mockApiClient: any;

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

        // Mock the workspace folders
        const mockWorkspaceFolder = {
            uri: {
                fsPath: '/test/workspace'
            } as vscode.Uri,
            name: 'Test Workspace',
            index: 0
        };

        // Mock vscode.workspace.workspaceFolders
        workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders');
        workspaceFoldersStub.value([mockWorkspaceFolder]);

        // Mock the binaryPath.getBinaryPath function
        sandbox.stub(binaryPath, 'getBinaryPath').returns('/test/bin/goosed');

        // Mock the startGoosed function
        startGoosedStub = sandbox.stub(gooseServer, 'startGoosed');

        // Create a proper mock process that extends EventEmitter
        const mockProcess = new EventEmitter();
        (mockProcess as any).kill = sandbox.stub();
        (mockProcess as any).pid = 12345;

        startGoosedStub.resolves({
            port: 8000,
            workingDir: '/test/workspace',
            process: mockProcess,
            secretKey: 'test-secret-key'
        });

        // Create a mock API client instance with the methods we need
        mockApiClient = {
            getAgentVersions: sandbox.stub().resolves({ versions: ['1.0.0', '2.0.0'] }),
            createAgent: sandbox.stub().resolves({ id: 'test-agent-id' }),
            request: sandbox.stub().resolves({}),
            getConversations: sandbox.stub().resolves([]),
            createConversation: sandbox.stub().resolves({ id: 'test-conversation-id' }),
            sendMessage: sandbox.stub().resolves({ id: 'test-message-id' }),
            getConfiguration: sandbox.stub().resolves({}),
            updateConfiguration: sandbox.stub().resolves({}),
            checkStatus: sandbox.stub().resolves(true),
            addExtension: sandbox.stub().resolves({ id: 'test-extension-id' }),
            streamMessage: sandbox.stub().callsFake(() => {
                const emitter = new EventEmitter();
                setTimeout(() => {
                    emitter.emit('data', { content: 'test content' });
                    emitter.emit('end');
                }, 10);
                return emitter;
            })
        };

        // Create a constructor stub for ApiClient
        const originalApiClient = ApiClient;
        class MockApiClient extends EventEmitter {
            constructor() {
                super();
                return mockApiClient;
            }
        }

        // Override the ApiClient class with our mock version
        sandbox.stub(require('../../shared/server/apiClient'), 'ApiClient').value(MockApiClient);

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
        // Create a realistic error scenario by making the getWorkspaceDirectory method throw
        sandbox.stub(serverManager as any, 'getWorkspaceDirectory').throws(new Error('Workspace directory error'));

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

    test('should handle server start failure gracefully', async () => {
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

    test('should handle server process exit', async () => {
        // Start the server
        await serverManager.start();

        // Spy on server exit events
        const exitListener = sandbox.spy();
        serverManager.on(ServerEvents.SERVER_EXIT, exitListener);

        // Spy on status change events
        const statusChangeListener = sandbox.spy();
        serverManager.on(ServerEvents.STATUS_CHANGE, statusChangeListener);

        // Simulate server process exit
        const serverProcess = (serverManager as any).serverInfo.process;
        serverProcess.emit('close', 0);

        // Verify exit event was emitted with correct code
        sinon.assert.calledWith(exitListener, 0);

        // Verify status was changed to stopped
        sinon.assert.calledWith(statusChangeListener, ServerStatus.STOPPED);

        // Verify server status is stopped
        assert.strictEqual(serverManager.getStatus(), ServerStatus.STOPPED);
    });

    test('should handle server process crash', async () => {
        // Start the server
        await serverManager.start();

        // Spy on server exit events
        const exitListener = sandbox.spy();
        serverManager.on(ServerEvents.SERVER_EXIT, exitListener);

        // Spy on status change events
        const statusChangeListener = sandbox.spy();
        serverManager.on(ServerEvents.STATUS_CHANGE, statusChangeListener);

        // Simulate server process crash
        const serverProcess = (serverManager as any).serverInfo.process;
        serverProcess.emit('close', 1);

        // Verify exit event was emitted with error code
        sinon.assert.calledWith(exitListener, 1);

        // Verify status was changed to stopped
        sinon.assert.calledWith(statusChangeListener, ServerStatus.STOPPED);

        // Verify server status is stopped
        assert.strictEqual(serverManager.getStatus(), ServerStatus.STOPPED);
    });

    test('should handle server process exit with null code', async () => {
        // Start the server
        await serverManager.start();

        // Spy on server exit events
        const exitListener = sandbox.spy();
        serverManager.on(ServerEvents.SERVER_EXIT, exitListener);

        // Spy on status change events
        const statusChangeListener = sandbox.spy();
        serverManager.on(ServerEvents.STATUS_CHANGE, statusChangeListener);

        // Simulate server process exit with null code (killed)
        const serverProcess = (serverManager as any).serverInfo.process;
        serverProcess.emit('close', null);

        // Verify exit event was emitted with null code
        sinon.assert.calledWith(exitListener, null);

        // Verify status was changed to stopped
        sinon.assert.calledWith(statusChangeListener, ServerStatus.STOPPED);

        // Verify server status is stopped
        assert.strictEqual(serverManager.getStatus(), ServerStatus.STOPPED);
    });

    test('should not emit server exit event when stopping server manually', async () => {
        // Start the server
        await serverManager.start();

        // Spy on server exit events
        const exitListener = sandbox.spy();
        serverManager.on(ServerEvents.SERVER_EXIT, exitListener);

        // Stop the server manually
        serverManager.stop();

        // Verify no exit event was emitted
        sinon.assert.notCalled(exitListener);

        // Verify server status is stopped
        assert.strictEqual(serverManager.getStatus(), ServerStatus.STOPPED);
    });
}); 
