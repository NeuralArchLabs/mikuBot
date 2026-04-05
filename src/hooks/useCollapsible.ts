/**
 * useCollapsible Hook
 * Manages collapsible state
 */

import { useState, useCallback } from 'react';

export function useCollapsible(initiallyCollapsed = false) {
    const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
    const toggle = useCallback(() => setIsCollapsed(prev => !prev), []);

    return { isCollapsed, toggle, setIsCollapsed };
}
