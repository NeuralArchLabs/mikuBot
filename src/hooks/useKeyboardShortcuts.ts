/**
 * useKeyboardShortcuts Hook
 * Registers keyboard shortcuts
 */

import { useEffect, useRef } from 'react';

export type KeyboardShortcut = {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    action: () => void;
    preventDefault?: boolean;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
    const shortcutsRef = useRef(shortcuts);

    // Keep ref updated
    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const { key, ctrlKey, altKey, shiftKey } = event;

            for (const shortcut of shortcutsRef.current) {
                if (
                    shortcut.key.toLowerCase() === key.toLowerCase() &&
                    (shortcut.ctrl === undefined || shortcut.ctrl === ctrlKey) &&
                    (shortcut.alt === undefined || shortcut.alt === altKey) &&
                    (shortcut.shift === undefined || shortcut.shift === shiftKey)
                ) {
                    if (shortcut.preventDefault !== false) {
                        event.preventDefault();
                    }
                    shortcut.action();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
}
