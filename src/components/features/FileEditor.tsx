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
}

export const FileEditor = ({
    files,
    selectedFile,
    setSelectedFile,
    onSave,
    unsavedChanges,
    setUnsavedChanges,
    onAddFile
}: FileEditorProps) => {
    const content = unsavedChanges[selectedFile] ?? files[selectedFile] ?? '';
    const isDirty = selectedFile in unsavedChanges;

    return (
        <div className="flex-1 flex h-full overflow-hidden bg-slate-900 text-slate-200">
            <div className="w-56 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                <div className="p-3 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Core Memory</span>
                    <button onClick={onAddFile} className="text-slate-500 hover:text-white transition-colors">
                        <Icon name="plus" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {Object.keys(files).sort().map(filename => (
                        <button
                            key={filename}
                            onClick={() => setSelectedFile(filename)}
                            className={`w-full text-left px-4 py-3 text-xs font-mono border-l-2 transition-all flex items-center justify-between group ${selectedFile === filename
                                ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300'
                                : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                                }`}
                        >
                            <span className="truncate">{filename}</span>
                            {filename in unsavedChanges && (
                                <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
                            )}
                        </button>
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
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-30">
                        <Icon name="file-contract" className="text-6xl mb-4" />
                        <p>Select a file to begin editing the mikuCentral Cortex</p>
                    </div>
                )}
            </div>
        </div>
    );
};
