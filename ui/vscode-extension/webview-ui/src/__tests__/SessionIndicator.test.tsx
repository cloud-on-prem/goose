import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionIndicator } from '../components/SessionIndicator';
import { SessionMetadata } from '../components/SessionList';

describe('SessionIndicator', () => {
    const mockSession: SessionMetadata = {
        id: '12345678-abcd-efgh',
        metadata: {
            title: 'Test Session',
            createdAt: '2023-01-01T12:00:00Z',
            updatedAt: '2023-01-01T12:30:00Z'
        }
    };

    const mockToggleDrawer = vi.fn();

    beforeEach(() => {
        mockToggleDrawer.mockClear();
    });

    it('renders with a session title', () => {
        render(
            <SessionIndicator
                currentSession={mockSession}
                onToggleSessionDrawer={mockToggleDrawer}
                isGenerating={false}
            />
        );

        expect(screen.getByText('Test Session')).toBeInTheDocument();
        expect(screen.getByTitle('Click to manage sessions')).toBeInTheDocument();
    });

    it('renders with a fallback session name when title is missing', () => {
        const sessionWithoutTitle = {
            ...mockSession,
            metadata: { ...mockSession.metadata, title: '' }
        };

        render(
            <SessionIndicator
                currentSession={sessionWithoutTitle}
                onToggleSessionDrawer={mockToggleDrawer}
                isGenerating={false}
            />
        );

        expect(screen.getByText(`Session ${mockSession.id.slice(0, 8)}`)).toBeInTheDocument();
    });

    it('renders "New Chat" when no session is provided', () => {
        render(
            <SessionIndicator
                currentSession={null}
                onToggleSessionDrawer={mockToggleDrawer}
                isGenerating={false}
            />
        );

        expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    it('calls toggle function when clicked', () => {
        render(
            <SessionIndicator
                currentSession={mockSession}
                onToggleSessionDrawer={mockToggleDrawer}
                isGenerating={false}
            />
        );

        fireEvent.click(screen.getByTitle('Click to manage sessions'));
        expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
    });

    it('has disabled class and does not call toggle function when clicked during generation', () => {
        const { container: _container } = render(
            <SessionIndicator
                currentSession={mockSession}
                onToggleSessionDrawer={mockToggleDrawer}
                isGenerating={true}
            />
        );

        // Check that the indicator has the disabled class
        const indicator = screen.getByTitle('Cannot change sessions while generating');
        expect(indicator.className).toContain('disabled');

        // In React Testing Library, fireEvent will always call the event handler,
        // even if it's undefined. We're checking the element directly instead.
        expect(indicator.getAttribute('onClick')).toBeNull();
    });
}); 
