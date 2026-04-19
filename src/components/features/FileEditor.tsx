import React from 'react';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';

interface FileEditorProps {
    files: Record<string, string>;
    selectedFile: string;
    setSelectedFile: (s: string) => void;
    onSave: (name: string, content: string) => Promise<boolean>;
    unsavedChanges: Record<string, string>;
    setUnsavedChanges: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onAddFile: () => void;
    onDelete: (name: string) => Promise<boolean>;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
}

export const FileEditor = ({
    files,
    selectedFile,
    setSelectedFile,
    onSave,
    unsavedChanges,
    setUnsavedChanges,
    onAddFile,
    onDelete,
    askConfirm
}: FileEditorProps) => {
    const { t } = useTranslation();
    const content = unsavedChanges[selectedFile] ?? files[selectedFile] ?? '';
    const isDirty = selectedFile in unsavedChanges;

    const handleDelete = async (filename: string) => {
        const disclaimer = t('editor.confirm.delete_warning');

        if (await askConfirm(disclaimer, 'center')) {
            if (await askConfirm(t('editor.confirm.delete_last', { filename }), 'center')) {
                const success = await onDelete(filename);
                if (success && selectedFile === filename) {
                    setSelectedFile('');
                    const next = { ...unsavedChanges };
                    delete next[filename];
                    setUnsavedChanges(next);
                }
            }
        }
    };

    return (
        <div className="flex-1 flex h-full overflow-hidden text-[var(--text-primary)]">
            <div 
                className="w-auto min-w-[120px] max-w-[160px] md:min-w-[160px] md:max-w-56 lg:min-w-[200px] lg:max-w-72 xl:min-w-[240px] xl:max-w-[320px] border-r border-[var(--border-color)] flex flex-col flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: 'var(--surface-color)', opacity: 0.9 }}
            >
                <div className="pl-7 pr-3 flex items-center justify-between border-b border-[var(--border-color)] min-h-[45px]">
                    <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t('editor.title')}</span>
                    <button onClick={onAddFile} className="text-[var(--text-secondary)] hover:text-[var(--primary-color)] transition-colors p-1" title={t('editor.add')}>
                        <Icon name="plus" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {Object.keys(files).sort().map(filename => (
                        <div key={filename} className="group relative">
                            <button
                                onClick={() => setSelectedFile(filename)}
                                className={`w-full text-left pl-7 pr-3 py-3 text-xs font-mono border-l-2 transition-all duration-300 flex items-center justify-between overflow-hidden ${selectedFile === filename
                                    ? 'bg-[var(--hover-color)] border-[var(--primary-color)] text-[var(--primary-color)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                    }`}
                                title={t('editor.edit_file', { filename })}
                            >
                                <span className="truncate flex-1">{filename}</span>
                                 {unsavedChanges[filename] !== undefined && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] flex-shrink-0 ml-2" />
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(filename);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                                title={t('editor.delete_file', { filename })}
                            >
                                <Icon name="times" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                {selectedFile ? (
                    <>
                        <div 
                            className="px-4 flex items-center justify-between border-b border-[var(--border-color)] min-h-[45px]"
                            style={{ backgroundColor: 'var(--surface-color)' }}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Icon name="file-alt" className="text-[var(--primary-color)] flex-shrink-0" />
                                <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest truncate">{selectedFile}</span>
                                {unsavedChanges[selectedFile] !== undefined && (
                                    <span 
                                        className="text-[8px] px-1.5 py-0.5 text-[var(--primary-color)] border border-[var(--primary-color)] rounded font-black uppercase"
                                        style={{ backgroundColor: 'var(--primary-color)', opacity: 0.15 }}
                                    >
                                        {t('editor.unsaved')}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDelete(selectedFile)}
                                    className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                                    title={t('editor.delete_file', { filename: selectedFile })}
                                >
                                    <Icon name="trash" />
                                </button>
                                <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
                                {unsavedChanges[selectedFile] !== undefined && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const next = { ...unsavedChanges };
                                                delete next[selectedFile];
                                                setUnsavedChanges(next);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            title={t('editor.discard')}
                                        >
                                            {t('editor.discard')}
                                        </button>
                                        <button
                                            onClick={() => onSave(selectedFile, content)}
                                            className="px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-all flex items-center gap-1"
                                            title={t('editor.save')}
                                        >
                                            <Icon name="save" /> {t('editor.save')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => {
                                setUnsavedChanges(prev => ({ ...prev, [selectedFile]: e.target.value }));
                            }}
                            title={t('editor.edit_file', { filename: selectedFile })}
                            placeholder={t('editor.placeholder')}
                            className="flex-1 text-[var(--text-primary)] font-mono text-xs p-4 focus:outline-none resize-none custom-scrollbar"
                            style={{ backgroundColor: 'var(--surface-color)', opacity: 0.95 }}
                            spellCheck={false}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-40 p-10 sm:p-16 text-center">
                        <Icon name="file-contract" className="text-5xl sm:text-7xl mb-5 sm:mb-8 animate-pulse text-[var(--primary-color)]" />
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-2">{t('editor.standby_title')}</h3>
                        <p className="text-[10px] sm:text-xs max-w-[240px] sm:max-w-xs leading-relaxed font-bold uppercase tracking-widest">{t('editor.standby_desc')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
