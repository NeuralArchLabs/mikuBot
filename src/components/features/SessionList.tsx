import React, { useEffect, useState } from 'react';
import { SessionMetadata } from '../../types';
import { persistence } from '../../services';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';

interface SessionListProps {
    sessions: SessionMetadata[];
    loading: boolean;
    currentSessionId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    onExport: (id: string) => void;
    onImport: () => void;
    onExpand?: () => void;
    isModal?: boolean;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    hideList?: boolean;
}

export const SessionList = React.memo(({ sessions, loading, currentSessionId, onSelect, onDelete, onNew, onExport, onImport, onExpand, isModal, askConfirm, hideList }: SessionListProps) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full">
            {!isModal && (
                <div className={`${hideList ? 'mb-0' : 'mb-0'}`}>
                    <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent mb-3" />
                    <div className="flex items-center justify-between px-1">
                        {onExpand ? (
                            <button
                                onClick={onExpand}
                                className="text-[10px] font-extrabold text-[var(--text-secondary)] hover:text-[var(--primary-color)] uppercase tracking-[0.18em] flex items-center gap-1.5 transition-colors group cursor-pointer"
                                title="Expand Sessions Viewer"
                            >
                                <Icon name="history" className="text-[9px] opacity-30 group-hover:opacity-100 group-hover:scale-110" />
                                {t('sidebar.tooltips.sessions')}
                            </button>
                        ) : (
                            <label className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-[0.18em] flex items-center gap-1.5">
                                <Icon name="history" className="text-[9px] opacity-30" />
                                {t('sidebar.tooltips.sessions')}
                            </label>
                        )}
                        {!hideList && (
                             <div className="flex items-center gap-1.5">
                                <button
                                    onClick={onImport}
                                    className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                                    title="Import Session"
                                >
                                    <Icon name="download" className="text-[10px]" />
                                </button>
                                <button
                                    onClick={onNew}
                                    className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 rounded-lg transition-all"
                                    title="New Session"
                                >
                                    <Icon name="plus" className="text-[10px]" />
                                </button>
                            </div>
                        )}
                    </div>
                    {!hideList && <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent mt-3 mb-0" />}
                </div>
            )}

            {!hideList && (
                <div className={`flex-1 overflow-y-auto overflow-x-visible custom-scrollbar chat-fade-mask px-4 -mx-4 pt-0 ${isModal ? 'space-y-2' : 'space-y-1'} pb-0 mb-0`}>
                {loading && sessions.length === 0 ? (
                    <div className="text-center py-4 text-[var(--text-secondary)] animate-pulse">
                        <Icon name="spinner" className="animate-spin mb-1" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--surface-color)]/30">
                        <p className={`${isModal ? 'text-sm' : 'text-[10px]'} text-[var(--text-secondary)]`}>{t('common.no_active_history')}</p>
                    </div>
                ) : (
                    <>
                        {/* Buffer to clear the top fade mask when fully scrolled */}
                        <div className="h-3 w-full flex-shrink-0" />
                        {sessions.map(ss => {
                            const isActive = currentSessionId === ss.id;
    
                            if (isModal) {
                                // 🪟 ORIGINAL WINDOW MODE LAYOUT (Modal)
                                return (
                                    <div
                                        key={ss.id}
                                        className={`group relative flex flex-col gap-1.5 rounded-xl p-4 transition-all duration-300 cursor-pointer border border-transparent ${isActive
                                            ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] shadow-lg shadow-black/10 sunken-active'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                            } hover:border-[var(--primary-color)]/30 hover:shadow-[0_0_20px_-5px_var(--primary-color)]/20`}
                                        onClick={() => onSelect(ss.id)}
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[var(--primary-color)] shadow-glow' : 'bg-[var(--border-color)]'}`} />
                                            <div className="text-sm font-medium truncate flex-1">{ss.title || t('common.untitled_session')}</div>
                                        </div>
    
                                        <div className="flex items-center justify-between pl-5 w-full">
                                            <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate">
                                                {ss.messageCount} messages • {new Date(ss.createdAt || ss.lastModified).toLocaleDateString()}
                                            </div>
    
                                            <div className="flex items-center gap-2 opacity-100">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onExport(ss.id); }}
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                                                    title="Export session"
                                                >
                                                    <Icon name="upload" className="text-sm" />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (await askConfirm(t('common.delete_session_confirm'), 'left')) onDelete(ss.id);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                                    title="Delete session"
                                                >
                                                    <Icon name="times" className="text-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
    
                            // 🖥️ OPTIMIZED SIDEBAR LAYOUT
                            return (
                                <div
                                    key={ss.id}
                                    className={`session-card session-card-sidebar group relative grid grid-cols-[auto_1fr] gap-x-2.5 items-center rounded-xl p-2.5 transition-all duration-300 cursor-pointer border border-transparent ${isActive
                                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] sunken-active'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                        } hover:border-[var(--primary-color)]/30 hover:shadow-[0_0_15px_-3px_var(--primary-color)]/20`}
                                    onClick={() => onSelect(ss.id)}
                                >
                                    {/* Status Indicator */}
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--primary-color)] shadow-glow' : 'bg-[var(--border-color)]'}`} />
    
                                    {/* Title - Dynamic Padding on Hover */}
                                    <div className="min-w-0 pr-0 group-hover:pr-[54px] transition-all duration-300">
                                        <div className="text-xs font-medium truncate">
                                            {ss.title || t('common.untitled_session')}
                                        </div>
                                        <div className="session-metadata text-[9px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                                            {ss.messageCount} msgs • {new Date(ss.createdAt || ss.lastModified).toLocaleDateString()}
                                        </div>
                                    </div>
    
                                    {/* Floating Actions */}
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onExport(ss.id); }}
                                            className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                                            title="Export session"
                                        >
                                            <Icon name="upload" className="text-[10px]" />
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (await askConfirm(t('common.delete_session_confirm'), 'left')) onDelete(ss.id);
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                            title="Delete session"
                                        >
                                            <Icon name="times" className="text-[10px]" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {/* Buffer to avoid scrollbar touching bottom directly */}
                        <div className="h-4 w-full flex-shrink-0" />
                    </>
                )}
                </div>
            )}
        </div>
    );
});
