import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/Header';

describe('Header Component', () => {
    it('renders with default props', () => {
        const mockToggleSession = vi.fn();
        const mockNewSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
                onNewSession={mockNewSession}
            />
        );

        // Check if header elements are present
        expect(screen.getByTitle('New Session')).toBeInTheDocument();
        expect(screen.getByTitle('Session History')).toBeInTheDocument();
        expect(screen.getByTitle('SERVER CONNECTED')).toBeInTheDocument();
    });

    it('displays GENERATING status when isGenerating is true', () => {
        const mockToggleSession = vi.fn();
        const mockNewSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={true}
                onNewSession={mockNewSession}
            />
        );

        expect(screen.getByTitle('GENERATING')).toBeInTheDocument();

        // Buttons should be disabled when generating
        const newSessionBtn = screen.getByTitle('New Session');
        const sessionHistoryBtn = screen.getByTitle('Session History');

        expect(newSessionBtn).toBeDisabled();
        expect(sessionHistoryBtn).toBeDisabled();
    });

    it('displays the actual status when not running or generating', () => {
        const mockToggleSession = vi.fn();
        const mockNewSession = vi.fn();

        render(
            <Header
                status="stopped"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
                onNewSession={mockNewSession}
            />
        );

        expect(screen.getByTitle('STOPPED')).toBeInTheDocument();
    });

    it('calls onToggleSessionDrawer when the history button is clicked', () => {
        const mockToggleSession = vi.fn();
        const mockNewSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
                onNewSession={mockNewSession}
            />
        );

        fireEvent.click(screen.getByTitle('Session History'));
        expect(mockToggleSession).toHaveBeenCalledTimes(1);
    });

    it('calls onNewSession when the new session button is clicked', () => {
        const mockToggleSession = vi.fn();
        const mockNewSession = vi.fn();

        render(
            <Header
                status="running"
                currentSession={null}
                onToggleSessionDrawer={mockToggleSession}
                isGenerating={false}
                onNewSession={mockNewSession}
            />
        );

        fireEvent.click(screen.getByTitle('New Session'));
        expect(mockNewSession).toHaveBeenCalledTimes(1);
    });
}); 
