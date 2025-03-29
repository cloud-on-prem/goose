import { useState, useEffect, useCallback } from 'react';
import { getVSCodeAPI } from '../utils/vscode';
import { MessageType } from '../types';
import { SessionMetadata } from '../components/SessionList';

interface UseSessionManagementResult {
    sessions: SessionMetadata[];
    currentSessionId: string | null;
    showSessionDrawer: boolean;
    fetchSessions: () => void;
    handleSessionSelect: (sessionId: string) => void;
    handleCreateSession: () => void;
    toggleSessionDrawer: () => void;
    currentSession: SessionMetadata | null;
}

export const useSessionManagement = (isLoading: boolean): UseSessionManagementResult => {
    const [sessions, setSessions] = useState<SessionMetadata[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showSessionDrawer, setShowSessionDrawer] = useState<boolean>(false);

    const vscode = getVSCodeAPI();

    const fetchSessions = useCallback(() => {
        try {
            console.log('Fetching sessions...');
            vscode.postMessage({
                command: MessageType.GET_SESSIONS
            });
        } catch (err) {
            console.error('Error fetching sessions:', err);
            setSessions([]);
        }
    }, [vscode]);

    const handleSessionSelect = useCallback((sessionId: string) => {
        if (isLoading) {
            return;
        } // Prevent session switching during generation

        // If we're already on this session, just close the drawer
        if (sessionId === currentSessionId) {
            setShowSessionDrawer(false);
            return;
        }

        console.log(`Switching to session: ${sessionId}`);
        vscode.postMessage({
            command: MessageType.SWITCH_SESSION,
            sessionId: sessionId
        });

        // Close the drawer after selection
        setShowSessionDrawer(false);
    }, [isLoading, currentSessionId, vscode]);

    const handleCreateSession = useCallback(() => {
        if (isLoading) {
            return;
        } // Prevent session creation during generation

        vscode.postMessage({
            command: MessageType.CREATE_SESSION
        });

        // Close the drawer after creation request
        setShowSessionDrawer(false);
    }, [isLoading, vscode]);

    const toggleSessionDrawer = useCallback(() => {
        if (isLoading) {
            return;
        } // Prevent toggling during generation

        // If we're opening the drawer, refresh the sessions list
        if (!showSessionDrawer) {
            fetchSessions();
        }

        setShowSessionDrawer(!showSessionDrawer);
    }, [isLoading, showSessionDrawer, fetchSessions]);

    // Set up listener for session-related events
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message || !message.command) {
                return;
            }

            switch (message.command) {
                case MessageType.SESSIONS_LIST:
                    // Handle sessions list
                    if (message.sessions) {
                        console.log('Received sessions list:', message.sessions);
                        // Ensure we're setting an array and validate session data structure
                        const validSessions = Array.isArray(message.sessions)
                            ? message.sessions.filter((session: any) =>
                                session &&
                                typeof session === 'object' &&
                                session.id &&
                                session.metadata &&
                                typeof session.metadata === 'object')
                            : [];

                        console.log('Valid sessions after filtering:', validSessions.length);
                        setSessions(validSessions);
                    }
                    break;
                case MessageType.SESSION_LOADED:
                case 'sessionLoaded':
                    // Handle session loaded event
                    if (message.sessionId) {
                        console.log('Loaded session:', message.sessionId);
                        setCurrentSessionId(message.sessionId);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Find the current session from the sessions list
    const currentSession = sessions.find(s => s && s.id === currentSessionId) || null;

    return {
        sessions,
        currentSessionId,
        showSessionDrawer,
        fetchSessions,
        handleSessionSelect,
        handleCreateSession,
        toggleSessionDrawer,
        currentSession
    };
}; 
