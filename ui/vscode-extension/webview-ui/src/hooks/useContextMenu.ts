import { useState, useEffect, useCallback } from 'react';

interface ContextMenuPosition {
    x: number;
    y: number;
}

interface UseContextMenuResult {
    position: ContextMenuPosition | null;
    isOpen: boolean;
    openMenu: (e: React.MouseEvent) => void;
    closeMenu: () => void;
}

export const useContextMenu = (): UseContextMenuResult => {
    const [position, setPosition] = useState<ContextMenuPosition | null>(null);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const openMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        // Calculate position, ensuring menu stays within viewport
        const x = Math.min(e.clientX, window.innerWidth - 200); // 200px is assumed menu width
        const y = Math.min(e.clientY, window.innerHeight - 150); // 150px is assumed menu height

        setPosition({ x, y });
        setIsOpen(true);
    }, []);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
        setPosition(null);
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (isOpen) {
                closeMenu();
            }
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen, closeMenu]);

    // Close menu when escape key is pressed
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeMenu();
            }
        };

        document.addEventListener('keydown', handleEscKey);

        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, closeMenu]);

    return {
        position,
        isOpen,
        openMenu,
        closeMenu
    };
}; 
