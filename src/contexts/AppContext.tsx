/**
 * AppContext
 * Global application state and configuration
 */

import { createContext, useContext, ReactNode } from 'react';
import type { AppConfig, AppState } from '../types';

interface AppContextValue {
    config: AppConfig;
    updateConfig: (updates: Partial<AppConfig>) => void;
    isLoading: boolean;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    // This is a placeholder - actual implementation would use useState and persistence
    const contextValue: AppContextValue = {
        config: {} as AppConfig,
        updateConfig: () => {},
        isLoading: false,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
}
