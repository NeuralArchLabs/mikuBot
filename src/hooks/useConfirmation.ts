/**
 * useConfirmation Hook
 * Manages confirmation dialog state
 */

import { useState, useCallback } from 'react';

export function useConfirmation() {
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        resolve?: (value: boolean) => void;
        message: string;
    }>({ isOpen: false, message: '' });

    const askConfirm = useCallback((msg: string): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({ isOpen: true, resolve, message: msg });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        confirmState.resolve?.(true);
        setConfirmState({ isOpen: false, message: '' });
    }, [confirmState]);

    const handleCancel = useCallback(() => {
        confirmState.resolve?.(false);
        setConfirmState({ isOpen: false, message: '' });
    }, [confirmState]);

    return {
        askConfirm,
        confirmState,
        handleConfirm,
        handleCancel,
    };
}
