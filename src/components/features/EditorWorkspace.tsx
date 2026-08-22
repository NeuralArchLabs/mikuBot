import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Common';
import { FileEditor } from './FileEditor';

type EditorScope = 'core' | 'commands';

interface EditorWorkspaceProps {
    coreFiles: Record<string, string>;
    commandFiles: Record<string, string>;
    onSaveCore: (name: string, content: string) => Promise<boolean>;
    onSaveCommands: (name: string, content: string) => Promise<boolean>;
    unsavedChanges: Record<string, string>;
    setUnsavedChanges: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onAddCore: () => void;
    onAddCommands: () => void;
    onDeleteCore: (name: string) => Promise<boolean>;
    onDeleteCommands: (name: string) => Promise<boolean>;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
}

/**
 * Shared editor shell for the two distinct system directories. The scope
 * switch is visual only; each FileEditor still saves through its original
 * core/tools target so the filesystem contract remains unchanged.
 */
export const EditorWorkspace = ({
    coreFiles,
    commandFiles,
    onSaveCore,
    onSaveCommands,
    unsavedChanges,
    setUnsavedChanges,
    onAddCore,
    onAddCommands,
    onDeleteCore,
    onDeleteCommands,
    askConfirm
}: EditorWorkspaceProps) => {
    const { t } = useTranslation();
    const [scope, setScope] = useState<EditorScope>('core');
    const [selectedCoreFile, setSelectedCoreFile] = useState('');
    const [selectedCommandsFile, setSelectedCommandsFile] = useState('');

    const isCore = scope === 'core';
    const selectedFile = isCore ? selectedCoreFile : selectedCommandsFile;
    const setSelectedFile = isCore ? setSelectedCoreFile : setSelectedCommandsFile;

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] px-5 py-3 sm:px-7">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
                        <Icon name="bolt" />
                    </div>
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--text-primary)]">
                        {t('editor.workspace_desc')}
                    </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-color)] p-1" role="tablist" aria-label={t('editor.title')}>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={isCore}
                        onClick={() => setScope('core')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${isCore
                            ? 'bg-[var(--primary-color)] text-white shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        {t('editor.scopes.core')}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!isCore}
                        onClick={() => setScope('commands')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${!isCore
                            ? 'bg-[var(--primary-color)] text-white shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        {t('editor.scopes.commands')}
                    </button>
                </div>
            </header>

            <div className="min-h-0 flex-1">
                {isCore ? (
                    <FileEditor
                        files={coreFiles}
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        onSave={onSaveCore}
                        unsavedChanges={unsavedChanges}
                        setUnsavedChanges={setUnsavedChanges}
                        onAddFile={onAddCore}
                        onDelete={onDeleteCore}
                        askConfirm={askConfirm}
                    />
                ) : (
                    <FileEditor
                        files={commandFiles}
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        onSave={onSaveCommands}
                        unsavedChanges={unsavedChanges}
                        setUnsavedChanges={setUnsavedChanges}
                        onAddFile={onAddCommands}
                        onDelete={onDeleteCommands}
                        askConfirm={askConfirm}
                    />
                )}
            </div>
        </div>
    );
};
