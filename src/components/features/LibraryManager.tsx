import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon, MarkdownRenderer } from '../common/Common';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../../types';
import { hydrateTemplate, extractVariablesFromConfig } from '../../services/core/BlueprintHydrator';

interface Blueprint {
    id: string;
    title: string;
    content: string;
    icon: string;
    category: string;
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
    onRename: (oldName: string, newName: string) => Promise<boolean>;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    config: AppConfig;
    editFileRequested?: string | null;
    onClearEditRequest?: () => void;
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
    onRename,
    askConfirm,
    config,
    editFileRequested,
    onClearEditRequest
}: LibraryManagerProps) => {
    const { t, i18n } = useTranslation();
    const [isClosing, setIsClosing] = useState(false);
    const [viewFile, setViewFile] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [showBlueprints, setShowBlueprints] = useState(false);
    const [renamingFile, setRenamingFile] = useState<string | null>(null);
    const [renameInput, setRenameInput] = useState('');
    const [rawBlueprints, setRawBlueprints] = useState<Blueprint[]>([]);
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);

    useEffect(() => {
        const loadBlueprints = async () => {
            const isElectron = typeof window !== 'undefined' && (window as any).electron?.listBlueprints;
            if (isElectron && config.folderPaths?.tools) {
                const response = await (window as any).electron.listBlueprints({
                    toolsPath: config.folderPaths.tools,
                    corePath: config.folderPaths.core,
                    lang: i18n.language
                });
                if (response.ok) {
                    setBlueprints(response.blueprints.filter((b: any) => b.category === 'library'));
                }
            }
        };
        if (showBlueprints) loadBlueprints();
    }, [showBlueprints, config.folderPaths?.tools, i18n.language]);


    useEffect(() => {
        if (isOpen && editFileRequested && files[editFileRequested]) {
            setViewFile(editFileRequested);
            setEditMode(true);
            setEditContent(files[editFileRequested]);
            onClearEditRequest?.();
        }
    }, [isOpen, editFileRequested, files, onClearEditRequest]);

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
        
        // Content is already localized by the IPC call
        let content = blueprint.content;
        const title = blueprint.title || blueprint.id;

        if (!content) return;

        // Simple Variable Injection (directly here for isolation)
        try {
            const vars = extractVariablesFromConfig(config);
            const langName = i18n.language.startsWith('es') ? 'Español' : i18n.language.startsWith('zh') ? '中文' : 'English';
            
            content = content.replace(/\{\{(\w+)\}\}/g, (match, name) => {
                if (name === 'LANGUAGE') return langName;
                return (vars as any)[name] || match;
            });
        } catch (err) { }

        const filename = `${title.replace(/[\s/\\:*?"<>|]+/g, '_')}_${timestamp}.md`;
        
        setSaving(true);
        try {
            const ok = await onSave(filename, content);
            if (ok) {
                setShowBlueprints(false);
                setViewFile(filename);
            }
        } finally {
            setSaving(false);
        }
    }, [onSave, config, i18n.language]);
 
    const handleRename = useCallback(async (oldName: string) => {
        if (!renameInput.trim() || renameInput === oldName) {
            setRenamingFile(null);
            return;
        }
        
        let newName = renameInput.trim();
        if (!newName.endsWith('.md')) newName += '.md';
        
        setSaving(true);
        try {
            const ok = await onRename(oldName, newName);
            if (ok) {
                setRenamingFile(null);
                if (viewFile === oldName) setViewFile(newName);
            }
        } finally {
            setSaving(false);
        }
    }, [renameInput, onRename, viewFile]);

    const handleDelete = useCallback(async (name: string) => {
        if (await askConfirm(t('library.confirm.delete', { name }), 'center')) {
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
            <div className={`relative bg-slate-900 border border-slate-900 hover:border-pink-500/50 transition-all duration-700 w-full max-w-6xl h-[85vh] shadow-[0_60px_150px_-30px_rgba(0,0,0,1)] hover:shadow-[0_0_50px_-10px_rgba(236,72,153,0.3)] flex flex-col overflow-hidden rounded-[2.5rem] ${isClosing ? 'animate-macos-shrink-bottom' : 'animate-macos-expand-bottom'}`}>

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="h-16 flex items-center justify-between px-6 bg-slate-950/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                            <Icon name="book" className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{t('library.title')}</h2>
                            <p className="text-xs text-slate-500">{t('library.desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowBlueprints(!showBlueprints)}
                            className="px-3 py-1.5 bg-gradient-to-r from-violet-600/20 to-pink-600/20 hover:from-violet-600/30 hover:to-pink-600/30 text-violet-300 rounded ring-1 ring-transparent hover:ring-violet-500/50 transition-all text-xs font-medium flex items-center gap-2 hover:scale-[1.02]"
                        >
                            <Icon name="magic" /> {t('library.blueprints.btn')}
                        </button>
                        <button
                            onClick={onAdd}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded ring-1 ring-transparent hover:ring-white/20 transition-all text-xs font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                            <Icon name="plus" />
                            <span className="hidden sm:inline">{t('library.actions.new_doc')}</span>
                            <span className="inline sm:hidden">{t('library.actions.new_doc_short')}</span>
                        </button>
                        <button onClick={handleClose} title={t('common.close') || 'Close'} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">
                            <Icon name="times" />
                        </button>
                    </div>
                </div>

                {/* ── Blueprints Drawer ──────────────────────────────── */}
                {showBlueprints && (
                    <div className="border-b border-slate-800 bg-slate-900/60 p-4 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon name="magic" className="text-violet-400 text-sm" />
                            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">{t('library.blueprints.title')}</span>
                            <span className="text-[10px] text-slate-600 ml-2">{t('library.blueprints.desc')}</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {blueprints.map((bp) => (
                                <button
                                    key={bp.id}
                                    onClick={() => handleCreateBlueprint(bp)}
                                    disabled={saving}
                                    className="group relative p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 transition-all text-left overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative z-10">
                                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                            <Icon name={bp.icon} />
                                        </div>
                                        <div className="font-bold text-slate-200 text-sm mb-1">{bp.title}</div>
                                        <div className="text-[10px] text-slate-500 leading-tight">{t('library.blueprints.create', { title: bp.title.toLowerCase() })}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────── */}
                <div className="flex-1 flex overflow-hidden">
                    {/* ── Sidebar ────────────────────────────────────── */}
                    <div className="w-1/3 bg-slate-950/20 flex flex-col">
                        <div className="p-3 bg-slate-900/80">
                            <input
                                type="text"
                                placeholder={t('library.actions.search')}
                                title={t('library.actions.search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 border-none rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-pink-500/50"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredFiles.length === 0 ? (
                                <div className="p-8 text-center text-slate-600 text-xs italic">
                                    {searchQuery ? t('library.actions.no_match') : t('library.actions.empty')}
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
                                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); onToggleSelect(name); }}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${isSelected
                                                        ? 'bg-pink-600 border-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                                                        : 'bg-slate-800 border-transparent text-transparent hover:bg-slate-700 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <Icon name="check" className="text-[10px]" />
                                                </div>
                                                <div className="truncate flex-1">
                                                    {renamingFile === name ? (
                                                        <input
                                                            autoFocus
                                                            value={renameInput}
                                                            onChange={(e) => setRenameInput(e.target.value)}
                                                            onBlur={() => handleRename(name)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(name);
                                                                if (e.key === 'Escape') setRenamingFile(null);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder={t('editor.placeholder')}
                                                            title={t('library.actions.rename')}
                                                            className="w-full bg-slate-700 ring-1 ring-pink-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                                                        />
                                                    ) : (
                                                        <div className={`text-sm font-mono truncate ${isActive ? 'text-pink-300' : 'text-slate-300'}`}>{name}</div>
                                                    )}
                                                    <div className="text-[10px] text-slate-600 truncate">{files[name].length} chars</div>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenamingFile(name);
                                                        setRenameInput(name);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-blue-400 rounded hover:bg-blue-500/10"
                                                    title={t('library.actions.rename')}
                                                >
                                                    <Icon name="edit" className="text-xs" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(name);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10"
                                                    title={t('library.actions.delete')}
                                                >
                                                    <Icon name="times" className="text-sm" />
                                                </button>
                                            </div>
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
                                <div className="h-10 flex items-center justify-between px-4 bg-slate-950/40">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-mono text-slate-500">{viewFile}</span>
                                    </div>
                                        <div className="flex items-center gap-2">
                                        {editMode ? (
                                            <>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                                                >
                                                    {t('editor.cancel')}
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {saving ? t('editor.saving') : t('editor.save_btn')}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleStartEdit(viewFile)}
                                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                                            >
                                                <Icon name="edit" /> {t('editor.edit')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {editMode ? (
                                    <div className="flex-1 flex overflow-hidden">
                                        {/* Editor */}
                                        <div className="w-1/2 flex flex-col">
                                            <div className="px-3 py-1 bg-slate-900/50">
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">{t('editor.editor')}</span>
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
                                            <div className="px-3 py-1 bg-slate-900/50">
                                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">{t('editor.live_preview')}</span>
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
                                <p className="text-sm font-mono">{t('library.actions.preview_select')}</p>
                                <p className="text-xs text-slate-600 max-w-xs text-center">
                                    {t('library.blueprints.desc')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="h-14 bg-slate-950/40 px-6 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        {t('sidebar.sessions_count', { count: selectedFiles.length })} • {t('sidebar.sessions_count', { count: Object.keys(files).length })}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded font-medium text-sm transition-colors shadow-lg shadow-pink-900/20"
                    >
                        {t('library.actions.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
