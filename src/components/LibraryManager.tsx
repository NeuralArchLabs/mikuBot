import React, { useState } from 'react';
import { Icon, MarkdownRenderer } from './Common';

interface LibraryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    files: Record<string, string>;
    selectedFiles: string[];
    onToggleSelect: (name: string) => void;
    onSave: (name: string, content: string) => Promise<boolean>;
    onAdd: () => void;
}

export const LibraryManager = ({
    isOpen,
    onClose,
    files,
    selectedFiles,
    onToggleSelect,
    onSave,
    onAdd
}: LibraryManagerProps) => {
    const [viewFile, setViewFile] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-8 transition-opacity duration-300 border-none">
            <div className="bg-slate-950 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                            <Icon name="book" className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Library Manager</h2>
                            <p className="text-xs text-slate-500">Inject additional context into your session</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onAdd} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors text-xs font-medium flex items-center gap-2">
                            <Icon name="plus" /> New Document
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">
                            <Icon name="times" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                        <div className="p-3 bg-slate-900/80 border-b border-slate-800">
                            <input type="text" placeholder="Search files..." className="w-full bg-slate-800 border-none rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-pink-500/50" />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {Object.keys(files).length === 0 ? (
                                <div className="p-8 text-center text-slate-600 text-xs italic">
                                    No files in library folder. Select a folder in settings or create a file.
                                </div>
                            ) : (
                                Object.keys(files).sort().map(name => {
                                    const isSelected = selectedFiles.includes(name);
                                    const isActive = viewFile === name;
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => setViewFile(name)}
                                            className={`w-full group flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); onToggleSelect(name); }}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${isSelected
                                                        ? 'bg-pink-600 border-pink-500 text-white'
                                                        : 'bg-slate-800 border-slate-600 text-transparent hover:border-slate-500'
                                                        }`}
                                                >
                                                    <Icon name="check" className="text-[10px]" />
                                                </div>
                                                <div className="truncate">
                                                    <div className={`text-sm font-mono truncate ${isActive ? 'text-pink-300' : 'text-slate-300'}`}>{name}</div>
                                                    <div className="text-[10px] text-slate-600 truncate">{files[name].length} chars</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-950 flex flex-col relative">
                        {viewFile ? (
                            <>
                                <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
                                    <span className="text-xs font-mono text-slate-500">{viewFile}</span>
                                    <span className="text-[10px] text-slate-600 uppercase tracking-widest">Read Only Preview</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <MarkdownRenderer content={files[viewFile]} />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-700">
                                <Icon name="eye" className="text-4xl opacity-20" />
                                <p className="text-sm font-mono">Select a file to preview</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-14 border-t border-slate-800 bg-slate-900 px-6 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        {selectedFiles.length} files selected for injection
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded font-medium text-sm transition-colors shadow-lg shadow-pink-900/20"
                    >
                        Apply Application Context
                    </button>
                </div>
            </div>
        </div>
    );
};
