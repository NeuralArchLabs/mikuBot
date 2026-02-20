import React from 'react';
import { Icon } from '../common/Common';

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
    const content = unsavedChanges[selectedFile] ?? files[selectedFile] ?? '';
    const isDirty = selectedFile in unsavedChanges;

    const handleDelete = async (filename: string) => {
        const disclaimer = "⚠️ WARNING: Deleting files from the Cortex or Command paths is a high-risk operation. Removing essential system files or custom commands could break MikuCentral functionality or result in data loss that cannot be undone.";

        if (await askConfirm(disclaimer, 'center')) {
            if (await askConfirm(`Are you absolutely sure you want to permanently delete "${filename}"? This action is irreversible.`, 'center')) {
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
        <div className="flex-1 flex h-full overflow-hidden bg-slate-900 text-slate-200">
            <div className="w-auto min-w-[120px] max-w-[160px] md:min-w-[160px] md:max-w-56 lg:min-w-[200px] lg:max-w-72 xl:min-w-[240px] xl:max-w-[320px] bg-slate-900/50 border-r border-slate-700 flex flex-col flex-shrink-0 overflow-hidden">
                <div className="p-3 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage Explorer</span>
                    <button onClick={onAddFile} className="text-slate-500 hover:text-white transition-colors">
                        <Icon name="plus" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {Object.keys(files).sort().map(filename => (
                        <div key={filename} className="group relative">
                            <button
                                onClick={() => setSelectedFile(filename)}
                                className={`w-full text-left px-3 py-3 text-xs font-mono border-l-2 transition-all flex items-center justify-between overflow-hidden ${selectedFile === filename
                                    ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300'
                                    : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                                    }`}
                            >
                                <span className="truncate pr-8">{filename}</span>
                                {filename in unsavedChanges && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(filename);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                                title="Delete file"
                            >
                                <Icon name="times" className="text-[10px]" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                {selectedFile ? (
                    <>
                        <div className="h-12 bg-slate-800/30 border-b border-slate-700 flex items-center justify-between px-4">
                            <div className="flex items-center gap-2 text-sm font-mono text-slate-300">
                                <Icon name="file-alt" className="text-slate-500" />
                                {selectedFile}
                                {isDirty && <span className="text-[10px] text-amber-500 font-bold bg-amber-900/20 px-1.5 rounded">UNSAVED</span>}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDelete(selectedFile)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                                    title="Delete this file"
                                >
                                    <Icon name="trash" />
                                </button>
                                <div className="w-px h-4 bg-slate-700 mx-1" />
                                {isDirty && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const next = { ...unsavedChanges };
                                                delete next[selectedFile];
                                                setUnsavedChanges(next);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={() => onSave(selectedFile, content)}
                                            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1"
                                        >
                                            <Icon name="save" /> Save
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
                            className="flex-1 bg-slate-900 text-slate-300 font-mono text-xs p-4 focus:outline-none resize-none custom-scrollbar"
                            spellCheck={false}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-30 p-10 sm:p-16 text-center">
                        <Icon name="file-contract" className="text-4xl sm:text-6xl mb-5 sm:mb-6" />
                        <p className="text-[12px] sm:text-sm max-w-[240px] sm:max-w-xs leading-relaxed font-medium">Select a file to begin editing the mikuCentral Cortex</p>
                    </div>
                )}
            </div>
        </div>
    );
};
