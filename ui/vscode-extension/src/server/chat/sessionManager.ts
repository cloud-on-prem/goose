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
        title?: string;
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
                return [];
            }

            try {
                const sessions = await apiClient.listSessions();
                if (Array.isArray(sessions) && sessions.length > 0) {
                    console.log(`Fetched ${sessions.length} sessions from API`);

                    // Process sessions to ensure they match our expected format
                    const processedSessions = sessions.map(session => {
                        // Make sure each session has a title and it's based on description if needed
                        if (!session.metadata.title && session.metadata.description) {
                            session.metadata.title = session.metadata.description;
                        } else if (!session.metadata.title) {
                            session.metadata.title = `Session ${session.id.slice(0, 8)}`;
                        }
                        return session;
                    });

                    this.sessions = processedSessions;
                    this.emit(SessionEvents.SESSIONS_LOADED, processedSessions);
                    return processedSessions;
                } else {
                    // No sessions available
                    console.log('No sessions returned from API');
                    this.sessions = [];
                    this.emit(SessionEvents.SESSIONS_LOADED, []);
                    return [];
                }
            } catch (error) {
                console.error('Error fetching sessions from API:', error);
                this.sessions = [];
                this.emit(SessionEvents.SESSIONS_LOADED, []);
                return [];
            }
        } catch (error) {
            console.error('Error in fetchSessions:', error);
            this.sessions = [];
            this.emit(SessionEvents.SESSIONS_LOADED, []);
            return [];
        }
    }

    /**
     * Load a specific session by ID
     */
    public async loadSession(sessionId: string): Promise<Session | null> {
        try {
            const apiClient = this.serverManager.getApiClient();
            if (!apiClient || !this.serverManager.isReady()) {
                console.error(`Cannot load session ${sessionId}: Server not ready`);
                return null;
            }

            try {
                const session = await apiClient.getSessionHistory(sessionId);

                // Make sure the session has a title property
                if (!session.metadata.title && session.metadata.description) {
                    session.metadata.title = session.metadata.description;
                }

                this.currentSessionId = sessionId;
                this.currentSession = session;
                this.emit(SessionEvents.SESSION_LOADED, session);
                return session;
            } catch (error) {
                console.error(`Error loading session ${sessionId} from API:`, error);
                return null;
            }
        } catch (error) {
            console.error(`Error in loadSession ${sessionId}:`, error);
            return null;
        }
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

            try {
                // Create a new session on the server
                const response = await apiClient.request('/sessions', {
                    method: 'POST',
                    body: JSON.stringify({
                        working_dir: workingDir,
                        title: description || `Session ${new Date().toLocaleString()}`
                    })
                });

                const sessionData = await response.json();
                const sessionId = sessionData.id;

                if (!sessionId) {
                    throw new Error('Failed to create session: No session ID returned');
                }

                // Load the newly created session
                await this.loadSession(sessionId);

                return sessionId;
            } catch (error) {
                console.error('Error creating session via API:', error);
                this.emit(SessionEvents.ERROR, error);
                return null;
            }
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
