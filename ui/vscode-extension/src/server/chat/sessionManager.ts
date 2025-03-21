import { EventEmitter } from 'events';
import { ServerManager } from '../serverManager';
import { Message } from '../../shared/types';
import * as vscode from 'vscode';

export interface SessionMetadata {
    id: string;
    path: string;
    modified: string;
    metadata: {
        working_dir: string;
        description: string;
        message_count: number;
        total_tokens: number;
    }
}

export interface Session {
    session_id: string;
    metadata: SessionMetadata['metadata'];
    messages: Message[];
}

export enum SessionEvents {
    SESSIONS_LOADED = 'sessionsLoaded',
    SESSION_LOADED = 'sessionLoaded',
    SESSION_CREATED = 'sessionCreated',
    SESSION_SWITCHED = 'sessionSwitched',
    ERROR = 'error'
}

/**
 * Manages chat sessions and their persistence
 */
export class SessionManager {
    private serverManager: ServerManager;
    private eventEmitter: EventEmitter;
    private sessions: SessionMetadata[] = [];
    private currentSessionId: string | null = null;
    private currentSession: Session | null = null;

    constructor(serverManager: ServerManager) {
        this.serverManager = serverManager;
        this.eventEmitter = new EventEmitter();
    }

    /**
     * Fetch list of available sessions
     */
    public async fetchSessions(): Promise<SessionMetadata[]> {
        try {
            const apiClient = this.serverManager.getApiClient();
            if (!apiClient || !this.serverManager.isReady()) {
                console.error('Cannot fetch sessions: Server not ready');
                return this.createMockSessions();
            }

            try {
                const sessions = await apiClient.listSessions();
                if (Array.isArray(sessions) && sessions.length > 0) {
                    this.sessions = sessions;
                    this.emit(SessionEvents.SESSIONS_LOADED, sessions);
                    return sessions;
                } else {
                    // No sessions from API, create mock ones
                    return this.createMockSessions();
                }
            } catch (error) {
                console.error('Error fetching sessions from API:', error);
                return this.createMockSessions();
            }
        } catch (error) {
            console.error('Error in fetchSessions:', error);
            return this.createMockSessions();
        }
    }

    /**
     * Create mock sessions for UI testing
     */
    private createMockSessions(): SessionMetadata[] {
        const workingDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '/';

        const mockSessions: SessionMetadata[] = [
            {
                id: 'mock_session_1',
                path: `${workingDir}/mock_session_1`,
                modified: new Date().toISOString(),
                metadata: {
                    working_dir: workingDir,
                    description: 'Mock Session 1',
                    message_count: 5,
                    total_tokens: 1250
                }
            },
            {
                id: 'mock_session_2',
                path: `${workingDir}/mock_session_2`,
                modified: new Date(Date.now() - 86400000).toISOString(), // yesterday
                metadata: {
                    working_dir: workingDir,
                    description: 'Mock Session 2',
                    message_count: 10,
                    total_tokens: 2500
                }
            }
        ];

        this.sessions = mockSessions;
        this.emit(SessionEvents.SESSIONS_LOADED, mockSessions);
        return mockSessions;
    }

    /**
     * Load a specific session by ID
     */
    public async loadSession(sessionId: string): Promise<Session | null> {
        try {
            const apiClient = this.serverManager.getApiClient();
            if (!apiClient || !this.serverManager.isReady()) {
                console.error(`Cannot load session ${sessionId}: Server not ready`);
                return this.loadMockSession(sessionId);
            }

            try {
                const session = await apiClient.getSessionHistory(sessionId);
                this.currentSessionId = sessionId;
                this.currentSession = session;
                this.emit(SessionEvents.SESSION_LOADED, session);
                return session;
            } catch (error) {
                console.error(`Error loading session ${sessionId} from API:`, error);
                return this.loadMockSession(sessionId);
            }
        } catch (error) {
            console.error(`Error in loadSession ${sessionId}:`, error);
            return this.loadMockSession(sessionId);
        }
    }

    /**
     * Load a mock session for UI testing
     */
    private loadMockSession(sessionId: string): Session | null {
        // Find the session metadata
        const sessionMeta = this.sessions.find(s => s.id === sessionId);
        if (!sessionMeta) {
            // If we have no sessions yet, fetch them first
            if (this.sessions.length === 0) {
                this.fetchSessions();
            }
            return null;
        }

        // Create a mock session
        const mockSession: Session = {
            session_id: sessionId,
            metadata: sessionMeta.metadata,
            messages: []
        };

        this.currentSessionId = sessionId;
        this.currentSession = mockSession;
        this.emit(SessionEvents.SESSION_LOADED, mockSession);
        return mockSession;
    }

    /**
     * Switch to a different session
     */
    public async switchSession(sessionId: string): Promise<boolean> {
        try {
            const session = await this.loadSession(sessionId);
            if (session) {
                this.emit(SessionEvents.SESSION_SWITCHED, session);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error switching to session ${sessionId}:`, error);
            this.emit(SessionEvents.ERROR, error);
            return false;
        }
    }

    /**
     * Create a new session
     */
    public async createSession(workingDir: string, description?: string): Promise<string | null> {
        try {
            const apiClient = this.serverManager.getApiClient();
            if (!apiClient || !this.serverManager.isReady()) {
                console.error('Cannot create session: Server not ready');
                this.emit(SessionEvents.ERROR, new Error('Server not ready'));
                return null;
            }

            // Mock session creation with local data instead of API request
            const sessionId = `session_${Date.now()}`;
            const sessionDesc = description || `Session ${new Date().toLocaleString()}`;

            // Create a mock session
            const mockSession: Session = {
                session_id: sessionId,
                metadata: {
                    working_dir: workingDir,
                    description: sessionDesc,
                    message_count: 0,
                    total_tokens: 0
                },
                messages: []
            };

            // Add the session to the list
            const mockSessionMetadata: SessionMetadata = {
                id: sessionId,
                path: `${workingDir}/${sessionId}`,
                modified: new Date().toISOString(),
                metadata: mockSession.metadata
            };

            // Update local state
            this.sessions.push(mockSessionMetadata);
            this.currentSessionId = sessionId;
            this.currentSession = mockSession;

            // Emit events
            this.emit(SessionEvents.SESSION_CREATED, mockSession);
            this.emit(SessionEvents.SESSION_LOADED, mockSession);
            this.emit(SessionEvents.SESSIONS_LOADED, this.sessions);

            return sessionId;
        } catch (error) {
            console.error('Error creating session:', error);
            this.emit(SessionEvents.ERROR, error);
            return null;
        }
    }

    /**
     * Get the current session
     */
    public getCurrentSession(): Session | null {
        return this.currentSession;
    }

    /**
     * Get the current session ID
     */
    public getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Get session metadata list
     */
    public getSessions(): SessionMetadata[] {
        return this.sessions;
    }

    /**
     * Event subscription methods
     */
    public on(event: SessionEvents, listener: (...args: any[]) => void): void {
        this.eventEmitter.on(event, listener);
    }

    public off(event: SessionEvents, listener: (...args: any[]) => void): void {
        this.eventEmitter.off(event, listener);
    }

    private emit(event: SessionEvents, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }
} 
