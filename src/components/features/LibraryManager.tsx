import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon, MarkdownRenderer } from '../common/Common';
import { AppConfig } from '../../types';

interface Blueprint {
    id: string;
    title: string;
    icon: string;
    category: string;
    content: string;
}

interface LibraryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    files: Record<string, string>;
    selectedFiles: string[];
    onToggleSelect: (name: string) => void;
    onSave: (name: string, content: string) => Promise<boolean>;
    onAdd: () => void;
    onDelete: (name: string) => Promise<boolean>;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    config: AppConfig;
}

export const LibraryManager = ({
    isOpen,
    onClose,
    files,
    selectedFiles,
    onToggleSelect,
    onSave,
    onAdd,
    onDelete,
    askConfirm,
    config
}: LibraryManagerProps) => {
    const [isClosing, setIsClosing] = useState(false);
    const [viewFile, setViewFile] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [showBlueprints, setShowBlueprints] = useState(false);
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);

    useEffect(() => {
        const loadBlueprints = async () => {
            const isElectron = typeof window !== 'undefined' && (window as any).electron?.listBlueprints;
            if (isElectron && config.folderPaths?.core) {
                const response = await (window as any).electron.listBlueprints({ corePath: config.folderPaths.core });
                if (response.ok) {
                    setBlueprints(response.blueprints.filter((b: any) => b.category === 'library'));
                }
            }
        };
        if (showBlueprints) loadBlueprints();
    }, [showBlueprints, config.folderPaths?.core]);

    const filteredFiles = useMemo(() => {
        const entries = Object.keys(files).sort();
        if (!searchQuery.trim()) return entries;
        const q = searchQuery.toLowerCase();
        return entries.filter(name =>
            name.toLowerCase().includes(q) ||
            files[name].toLowerCase().includes(q)
        );
    }, [files, searchQuery]);

    const handleStartEdit = useCallback((name: string) => {
        setEditMode(true);
        setEditContent(files[name] || '');
    }, [files]);

    const handleSaveEdit = useCallback(async () => {
        if (!viewFile) return;
        setSaving(true);
        try {
            const ok = await onSave(viewFile, editContent);
            if (ok) {
                setEditMode(false);
            }
        } finally {
            setSaving(false);
        }
    }, [viewFile, editContent, onSave]);

    const handleCancelEdit = useCallback(() => {
        setEditMode(false);
        setEditContent('');
    }, []);

    const handleCreateBlueprint = useCallback(async (blueprint: Blueprint) => {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${blueprint.title.replace(/\s+/g, '_')}_${timestamp}.md`;

        setSaving(true);
        try {
            const ok = await onSave(filename, blueprint.content);
            if (ok) {
                setShowBlueprints(false);
                setViewFile(filename);
            }
        } finally {
            setSaving(false);
        }
    }, [onSave]);

    const handleDelete = useCallback(async (name: string) => {
        if (await askConfirm(`Are you sure you want to permanently delete "${name}" from your library?`, 'center')) {
            const ok = await onDelete(name);
            if (ok && viewFile === name) {
                setViewFile(null);
                setEditMode(false);
            }
        }
    }, [askConfirm, onDelete, viewFile]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 400);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8 transition-opacity duration-300 border-none ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={handleClose} />
            <div className={`relative bg-slate-950 border border-slate-700 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-macos-shrink-bottom' : 'animate-macos-expand-bottom'}`}>

                {/* ── Header ─────────────────────────────────────────── */}
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowBlueprints(!showBlueprints)}
                            className="px-3 py-1.5 bg-gradient-to-r from-violet-600/20 to-pink-600/20 hover:from-violet-600/30 hover:to-pink-600/30 text-violet-300 rounded border border-violet-500/30 transition-all text-xs font-medium flex items-center gap-2 hover:scale-[1.02]"
                        >
                            <Icon name="magic" /> Blueprints
                        </button>
                        <button
                            onClick={onAdd}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors text-xs font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                            <Icon name="plus" />
                            <span className="hidden sm:inline">New Document</span>
                            <span className="inline sm:hidden">New Doc</span>
                        </button>
                        <button onClick={handleClose} title="Close Library Manager" className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">
                            <Icon name="times" />
                        </button>
                    </div>
                </div>

                {/* ── Blueprints Drawer ──────────────────────────────── */}
                {showBlueprints && (
                    <div className="border-b border-slate-800 bg-slate-900/60 p-4 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon name="magic" className="text-violet-400 text-sm" />
                            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Assistant Blueprints</span>
                            <span className="text-[10px] text-slate-600 ml-2">Pre-built templates for common use cases</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {blueprints.map((bp) => (
                                <button
                                    key={bp.id}
                                    onClick={() => handleCreateBlueprint(bp)}
                                    disabled={saving}
                                    className="group relative p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 hover:border-violet-500/30 transition-all text-left overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative z-10">
                                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                            <Icon name={bp.icon} />
                                        </div>
                                        <div className="font-bold text-slate-200 text-sm mb-1">{bp.title}</div>
                                        <div className="text-[10px] text-slate-500 leading-tight">Create a new {bp.title.toLowerCase()} document</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────── */}
                <div className="flex-1 flex overflow-hidden">
                    {/* ── Sidebar ────────────────────────────────────── */}
                    <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                        <div className="p-3 bg-slate-900/80 border-b border-slate-800">
                            <input
                                type="text"
                                placeholder="Search files..."
                                title="Search library files"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 border-none rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-pink-500/50"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredFiles.length === 0 ? (
                                <div className="p-8 text-center text-slate-600 text-xs italic">
                                    {searchQuery ? 'No matching files found.' : 'No files in library folder. Select a folder in settings or create a file.'}
                                </div>
                            ) : (
                                filteredFiles.map(name => {
                                    const isSelected = selectedFiles.includes(name);
                                    const isActive = viewFile === name;
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => { setViewFile(name); setEditMode(false); }}
                                            className={`group relative w-full flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-slate-800' : 'hover:bg-slate-800/50'
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
                                                <div className="truncate pr-8">
                                                    <div className={`text-sm font-mono truncate ${isActive ? 'text-pink-300' : 'text-slate-300'}`}>{name}</div>
                                                    <div className="text-[10px] text-slate-600 truncate">{files[name].length} chars</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(name);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-500/10"
                                                title="Delete file"
                                            >
                                                <Icon name="times" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Content Area ───────────────────────────────── */}
                    <div className="flex-1 bg-slate-950 flex flex-col relative">
                        {viewFile ? (
                            <>
                                <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-mono text-slate-500">{viewFile}</span>
                                        {!editMode && (
                                            <button
                                                onClick={() => handleDelete(viewFile)}
                                                className="text-slate-600 hover:text-red-400 p-1.5 transition-colors rounded hover:bg-red-500/10"
                                                title="Delete file"
                                            >
                                                <Icon name="trash" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editMode ? (
                                            <>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {saving ? 'Saving...' : '💾 Save'}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleStartEdit(viewFile)}
                                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                                            >
                                                <Icon name="edit" /> Edit
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {editMode ? (
                                    <div className="flex-1 flex overflow-hidden">
                                        {/* Editor */}
                                        <div className="w-1/2 border-r border-slate-800 flex flex-col">
                                            <div className="px-3 py-1 border-b border-slate-800 bg-slate-900/50">
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">Editor</span>
                                            </div>
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                title="Edit file content"
                                                className="flex-1 w-full bg-transparent border-none outline-none p-4 text-sm font-mono text-slate-300 resize-none custom-scrollbar"
                                                spellCheck={false}
                                            />
                                        </div>
                                        {/* Live Preview */}
                                        <div className="w-1/2 flex flex-col">
                                            <div className="px-3 py-1 border-b border-slate-800 bg-slate-900/50">
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">Live Preview</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                                <MarkdownRenderer content={editContent} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                        <MarkdownRenderer content={files[viewFile]} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-700">
                                <Icon name="eye" className="text-4xl opacity-20" />
                                <p className="text-sm font-mono">Select a file to preview</p>
                                <p className="text-xs text-slate-600 max-w-xs text-center">
                                    Or use <span className="text-violet-400 font-medium">Blueprints</span> to create a pre-built template
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="h-14 border-t border-slate-800 bg-slate-900 px-6 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        {selectedFiles.length} files selected for injection • {Object.keys(files).length} total
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
