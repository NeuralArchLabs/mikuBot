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
        <div className="flex-1 flex h-full overflow-hidden text-slate-200">
            <div className="w-auto min-w-[120px] max-w-[160px] md:min-w-[160px] md:max-w-56 lg:min-w-[200px] lg:max-w-72 xl:min-w-[240px] xl:max-w-[320px] bg-slate-900/30 border-r border-slate-800/50 flex flex-col flex-shrink-0 overflow-hidden">
                <div className="p-3 flex items-center justify-between border-b border-slate-800/50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('editor.title')}</span>
                    <button onClick={onAddFile} className="text-slate-500 hover:text-cyan-400 transition-colors" title={t('editor.add')}>
                        <Icon name="plus" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {Object.keys(files).sort().map(filename => (
                        <div key={filename} className="group relative">
                            <button
                                onClick={() => setSelectedFile(filename)}
                                className={`w-full text-left px-3 py-3 text-xs font-mono border-l-2 transition-all duration-300 flex items-center justify-between overflow-hidden ${selectedFile === filename
                                    ? 'bg-slate-800 border-cyan-500 text-cyan-400'
                                    : 'border-transparent text-slate-500 hover:bg-slate-800/30 hover:text-slate-300'
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
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
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
                        <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/50 flex items-center justify-between min-h-[45px]">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Icon name="file-alt" className="text-cyan-500 flex-shrink-0" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{selectedFile}</span>
                                {unsavedChanges[selectedFile] !== undefined && (
                                    <span className="text-[8px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded font-black uppercase">{t('editor.unsaved')}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDelete(selectedFile)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                                    title={t('editor.delete_file', { filename: selectedFile })}
                                >
                                    <Icon name="trash" />
                                </button>
                                <div className="w-px h-4 bg-slate-700 mx-1" />
                                {unsavedChanges[selectedFile] !== undefined && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const next = { ...unsavedChanges };
                                                delete next[selectedFile];
                                                setUnsavedChanges(next);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                                            title={t('editor.discard')}
                                        >
                                            {t('editor.discard')}
                                        </button>
                                        <button
                                            onClick={() => onSave(selectedFile, content)}
                                            className="px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all flex items-center gap-1"
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
                            className="flex-1 bg-slate-950/60 text-slate-300 font-mono text-xs p-4 focus:outline-none resize-none custom-scrollbar"
                            spellCheck={false}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-40 p-10 sm:p-16 text-center">
                        <Icon name="file-contract" className="text-5xl sm:text-7xl mb-5 sm:mb-8 animate-pulse" />
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('editor.standby_title')}</h3>
                        <p className="text-[10px] sm:text-xs max-w-[240px] sm:max-w-xs leading-relaxed font-bold uppercase tracking-widest">{t('editor.standby_desc')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
