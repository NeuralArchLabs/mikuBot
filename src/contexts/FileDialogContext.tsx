/**
 * FileDialogContext
 * File dialog management
 */

import { createContext, useContext, ReactNode } from 'react';

interface FileDialogContextValue {
    openFileDialog: (options?: any) => Promise<string | null>;
    openSaveDialog: (options?: any) => Promise<string | null>;
}

export const FileDialogContext = createContext<FileDialogContextValue | undefined>(undefined);

export function FileDialogProvider({ children }: { children: ReactNode }) {
    // This is a placeholder - actual implementation would use electron APIs
    const contextValue: FileDialogContextValue = {
        openFileDialog: async () => null,
        openSaveDialog: async () => null,
    };

    return (
        <FileDialogContext.Provider value={contextValue}>
            {children}
        </FileDialogContext.Provider>
    );
}

export function useFileDialogContext() {
    const context = useContext(FileDialogContext);
    if (context === undefined) {
        throw new Error('useFileDialogContext must be used within FileDialogProvider');
    }
    return context;
}
