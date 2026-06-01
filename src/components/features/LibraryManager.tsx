import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon, MarkdownRenderer } from '../common/Common';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../../types';
import { hydrateTemplate, extractVariablesFromConfig } from '../../services/core/BlueprintHydrator';
import { useUIStore } from '../../stores/useUIStore';

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
    const [showPreview, setShowPreview] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const setOverlayActive = useUIStore((state) => state.setOverlayActive);

    // Sync with global UI Store
    useEffect(() => {
        setOverlayActive('library', isOpen && !isClosing);
        // Ensure we clear it if unmounted while open (though unlikely in this app structure)
        return () => {
            if (isOpen) setOverlayActive('library', false);
        };
    }, [isOpen, isClosing, setOverlayActive]);

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

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 400);
    }, [onClose]);

    const handleApply = useCallback(() => {
        if (!viewFile) return;
        // If the file is not selected, select it
        if (!selectedFiles.includes(viewFile)) {
            onToggleSelect(viewFile);
        }
        handleClose();
    }, [viewFile, selectedFiles, onToggleSelect, handleClose]);

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


    if (!isOpen) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[120] flex items-center justify-center px-1.5 py-6 sm:px-3 sm:py-10 lg:p-8 transition-opacity duration-300 border-none ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={handleClose} />
            <div className={`relative bg-[var(--surface-color)] [.theme-cloud_&]:bg-slate-900/95 border border-[var(--border-color)]/30 [.theme-cloud_&]:border-slate-800/40 transition-all duration-700 w-full h-full lg:max-w-6xl lg:h-[85vh] shadow-[0_30px_100px_rgba(0,0,0,0.5)] hover:shadow-[0_0_50px_-10px_rgba(236,72,153,0.2)] flex flex-col overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] ${isClosing ? 'animate-macos-shrink-bottom' : 'animate-macos-expand-bottom'}`}>

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="h-16 flex items-center justify-between px-6 bg-[var(--background-color)]/25 [.theme-cloud_&]:bg-slate-700/95 relative z-20 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="group w-10 h-10 rounded-full bg-pink-500/15 text-pink-400 flex items-center justify-center border border-transparent transition-all duration-300 relative overflow-hidden hover:border-pink-500/30 hover:shadow-[inset_0_0_12px_rgba(236,72,153,0.2)]"
                            title={showSidebar ? t('common.hide_sidebar') || 'Hide Sidebar' : t('common.show_sidebar') || 'Show Sidebar'}
                        >
                            <div className="relative w-full h-full">
                                <Icon 
                                    name="book" 
                                    className={`text-xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 transform-gpu ${!showSidebar ? 'scale-0 opacity-0' : 'group-hover:scale-0 group-hover:opacity-0 scale-100 opacity-100'}`} 
                                />
                                <Icon 
                                    name="expand" 
                                    className={`text-xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 transform-gpu ${!showSidebar ? 'opacity-100 scale-100' : 'opacity-0 scale-150 group-hover:opacity-100 group-hover:scale-100'}`} 
                                />
                            </div>
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)] [.theme-cloud_&]:text-slate-100 tracking-tight">{t('library.title')}</h2>
                            <p className="text-xs text-[var(--text-secondary)] [.theme-cloud_&]:text-slate-400 opacity-80">{t('library.desc')}</p>
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
                            className="px-3 py-1.5 bg-[var(--hover-color)] hover:bg-[var(--border-color)]/20 text-[var(--text-primary)] [.theme-cloud_&]:text-slate-100 rounded ring-1 ring-transparent hover:ring-[var(--text-primary)]/20 transition-all text-xs font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                            <Icon name="plus" />
                            <span className="hidden sm:inline">{t('library.actions.new_doc')}</span>
                            <span className="inline sm:hidden">{t('library.actions.new_doc_short')}</span>
                        </button>
                        <button onClick={handleClose} title={t('common.close') || 'Close'} className="w-8 h-8 rounded-full bg-[var(--hover-color)] hover:bg-[var(--border-color)]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all border border-transparent hover:border-[var(--text-secondary)]/60">
                            <Icon name="times" />
                        </button>
                    </div>
                </div>

                {/* ── Blueprints Drawer ──────────────────────────────── */}
                {showBlueprints && (
                    <div className="border-b border-[var(--border-color)]/20 bg-[var(--background-color)]/50 [.theme-cloud_&]:bg-slate-900/40 p-4 animate-in fade-in relative z-0 shadow-[inset_0_-10px_30px_-10px_rgba(0,0,0,0.3)]">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon name="magic" className="text-violet-400 text-sm" />
                            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">{t('library.blueprints.title')}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] [.theme-cloud_&]:text-slate-400 ml-2 opacity-60">{t('library.blueprints.desc')}</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {blueprints.map((bp) => (
                                <button
                                    key={bp.id}
                                    onClick={() => handleCreateBlueprint(bp)}
                                    disabled={saving}
                                    className="group relative p-4 rounded-xl bg-[var(--surface-color)]/40 hover:bg-[var(--surface-color)]/60 transition-all text-left overflow-hidden border border-[var(--border-color)]/10 shadow-sm hover:shadow-md"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative z-10">
                                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                            <Icon name={bp.icon} />
                                        </div>
                                        <div className="font-bold text-[var(--text-primary)] text-sm mb-1">{bp.title}</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] leading-tight">{t('library.blueprints.create', { title: bp.title.toLowerCase() })}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────── */}
                <div className="flex-1 flex overflow-hidden">
                    {/* ── Sidebar ────────────────────────────────────── */}
                    <div className={`bg-[var(--background-color)]/30 [.theme-cloud_&]:bg-slate-800/95 flex flex-col border-r border-[var(--border-color)]/10 [.theme-cloud_&]:border-slate-700/30 relative z-10 shadow-[10px_0_40px_rgba(0,0,0,0.15)] transition-all duration-500 ease-in-out ${showSidebar ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none shadow-none'}`}>
                        <div className="p-3 bg-[var(--surface-color)]/60 [.theme-cloud_&]:bg-slate-900/40 backdrop-blur-sm border-b border-[var(--border-color)]/10 [.theme-cloud_&]:border-slate-700/30">
                            <input
                                type="text"
                                placeholder={t('library.actions.search')}
                                title={t('library.actions.search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--hover-color)] [.theme-cloud_&]:bg-slate-700/50 border border-[var(--border-color)]/20 [.theme-cloud_&]:border-slate-600/30 rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] [.theme-cloud_&]:text-slate-100 outline-none focus:ring-1 focus:ring-pink-500/50 shadow-inner"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredFiles.length === 0 ? (
                                <div className="p-8 text-center text-[var(--text-secondary)] text-xs italic opacity-50">
                                    {searchQuery ? t('library.actions.no_match') : t('library.actions.empty')}
                                </div>
                            ) : (
                                filteredFiles.map(name => {
                                    const isSelected = selectedFiles.includes(name);
                                    const isActive = viewFile === name;
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => { 
                                                if (isActive) {
                                                    setViewFile(null);
                                                } else {
                                                    setViewFile(name); 
                                                    setEditMode(false); 
                                                }
                                            }}
                                            className={`group relative w-full flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-[var(--hover-color)] shadow-sm' : 'hover:bg-[var(--hover-color)]/40'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); onToggleSelect(name); }}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${isSelected
                                                        ? 'bg-pink-600 border-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                                                        : isActive
                                                            ? 'bg-[var(--surface-color)] border-[var(--border-color)]/50 text-transparent hover:border-[var(--primary-color)]/30'
                                                            : 'bg-[var(--hover-color)] border-transparent text-transparent hover:bg-[var(--surface-color)] hover:border-[var(--border-color)]/30'
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
                                                            className="w-full bg-[var(--hover-color)] ring-1 ring-pink-500/40 rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none"
                                                        />
                                                    ) : (
                                                        <div className={`text-sm font-mono truncate ${isActive ? 'text-pink-400 font-bold' : 'text-[var(--text-primary)] [.theme-cloud_&]:text-slate-200'}`}>{name}</div>
                                                    )}
                                                    <div className="text-[10px] text-[var(--text-secondary)] [.theme-cloud_&]:text-slate-400 truncate opacity-60">{files[name].length} chars</div>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenamingFile(name);
                                                        setRenameInput(name);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] hover:text-blue-400 rounded hover:bg-blue-500/10"
                                                    title={t('library.actions.rename')}
                                                >
                                                    <Icon name="edit" className="text-xs" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(name);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 rounded hover:bg-red-500/10"
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
                    <div className="flex-1 min-w-0 bg-[var(--background-color)]/50 [.theme-cloud_&]:bg-slate-700/90 [.theme-cloud_&]:text-slate-100 flex flex-col relative">
                        {viewFile ? (
                            <>
                                <div className="h-10 flex items-center justify-between px-4 bg-[var(--surface-color)]/40 [.theme-cloud_&]:bg-slate-800/40 border-b border-[var(--border-color)]/10 [.theme-cloud_&]:border-slate-700/20 shadow-sm relative z-10">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-mono text-[var(--text-secondary)] [.theme-cloud_&]:text-slate-200">{viewFile}</span>
                                    </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setShowSidebar(!showSidebar)}
                                                className="w-6 h-6 rounded bg-[var(--hover-color)] hover:bg-[var(--border-color)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors mr-1"
                                                title={showSidebar ? t('common.hide_sidebar') : t('common.show_sidebar')}
                                            >
                                                <Icon name="expand" className="text-[13px]" />
                                            </button>

                                            {editMode ? (
                                            <>
                                                <button
                                                    onClick={() => setShowPreview(!showPreview)}
                                                    className={`px-3 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 border border-transparent ${showPreview ? 'bg-violet-600/20 text-violet-400 hover:border-violet-500/40' : 'bg-[var(--hover-color)] hover:bg-[var(--border-color)]/20 text-[var(--text-secondary)]'}`}
                                                >
                                                    <Icon name={showPreview ? 'edit' : 'eye'} /> {showPreview ? t('editor.editor') : t('editor.live_preview')}
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="px-3 py-1 bg-[var(--hover-color)] hover:bg-[var(--border-color)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all rounded text-[10px] font-medium border border-transparent hover:border-[var(--border-color)]/30"
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
                                                className="px-3 py-1 bg-[var(--hover-color)] [.theme-cloud_&]:bg-slate-700/40 hover:bg-[var(--border-color)]/20 text-[var(--text-secondary)] [.theme-cloud_&]:text-slate-300 hover:text-[var(--text-primary)] [.theme-cloud_&]:hover:text-slate-100 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                                            >
                                                <Icon name="edit" /> {t('editor.edit')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {editMode ? (
                                    showPreview ? (
                                        <div className="flex-1 overflow-auto p-8 custom-scrollbar [.theme-cloud_&_.markdown-body]:text-slate-100 whitespace-pre-wrap break-words">
                                            <MarkdownRenderer content={editContent} />
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                title="Edit file content"
                                                className="flex-1 w-full bg-transparent border-none outline-none p-4 text-sm font-mono text-[var(--text-primary)] [.theme-cloud_&]:text-slate-100 resize-none custom-scrollbar"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex-1 overflow-auto p-8 custom-scrollbar [.theme-cloud_&_.markdown-body]:text-slate-100 whitespace-pre-wrap break-words">
                                        <MarkdownRenderer content={files[viewFile]} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-[var(--text-secondary)] opacity-40">
                                <Icon name="eye" className="text-4xl" />
                                <p className="text-sm font-mono">{t('library.actions.preview_select')}</p>
                                <p className="text-xs max-w-xs text-center">
                                    {t('library.blueprints.desc')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="h-14 bg-[var(--background-color)]/30 [.theme-cloud_&]:bg-slate-700/95 flex items-center border-t border-[var(--border-color)]/10 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                    {/* Spacer to align with sidebar and keep button centered to content area */}
                    <div className={`hidden lg:block transition-all duration-500 ease-in-out ${showSidebar ? 'w-80' : 'w-0'}`} />
                    
                    <div className="flex-1 flex items-center justify-center">
                        <button
                            onClick={handleApply}
                            disabled={!viewFile}
                            className={`px-10 py-2.5 rounded-full font-black text-sm btn-volume-premium transition-all ${viewFile ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-[0_10px_30px_rgba(236,72,153,0.4)] opacity-100 cursor-pointer' : 'bg-gray-700/50 text-gray-500 opacity-50 cursor-not-allowed shadow-none'}`}
                        >
                            {t('library.actions.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
