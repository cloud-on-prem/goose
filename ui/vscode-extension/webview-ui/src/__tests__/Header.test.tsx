import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/Header';

// Mock the SessionIndicator component
vi.mock('../components/SessionIndicator', () => ({
    SessionIndicator: ({ currentSession, onToggleSessionDrawer, isGenerating }) => (
        <div data-testid="session-indicator">
            <span>{currentSession?.metadata?.title || 'No session'}</span>
            <button onClick={onToggleSessionDrawer}>Toggle</button>
            {isGenerating && <span>Generating</span>}
        </div>
    ),
}));

describe('Header Component', () => {
    it('renders with default props', () => {
        const mockToggleSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
            />
        );

        // Check if header elements are present
        expect(screen.getByText('Goose')).toBeInTheDocument();
        expect(screen.getByText('SERVER CONNECTED')).toBeInTheDocument();
        expect(screen.getByTestId('session-indicator')).toBeInTheDocument();
    });

    it('displays GENERATING status when isGenerating is true', () => {
        const mockToggleSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={true}
            />
        );

        expect(screen.getByText('GENERATING')).toBeInTheDocument();
    });

    it('displays the actual status when not running or generating', () => {
        const mockToggleSession = vi.fn();

        render(
            <Header
                status="stopped"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
            />
        );

        expect(screen.getByText('stopped')).toBeInTheDocument();
    });

    it('passes session data to SessionIndicator', () => {
        const mockToggleSession = vi.fn();
        const mockSession = {
            id: 'session-123',
            metadata: {
                title: 'Test Session',
                timestamp: Date.now(),
                lastUpdated: Date.now()
            }
        };

        render(
            <Header
                status="running"
                currentSession={mockSession}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
            />
        );

        expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('calls onToggleSessionDrawer when the toggle button is clicked', () => {
        const mockToggleSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
            />
        );

        fireEvent.click(screen.getByText('Toggle'));
        expect(mockToggleSession).toHaveBeenCalledTimes(1);
    });
}); 
