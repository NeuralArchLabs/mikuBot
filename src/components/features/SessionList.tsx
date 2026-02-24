import React, { useEffect, useState } from 'react';
import { SessionMetadata } from '../../types';
import { persistence } from '../../services';
import { Icon } from '../common/Common';

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
}

export const SessionList = React.memo(({ sessions, loading, currentSessionId, onSelect, onDelete, onNew, onExport, onImport, onExpand, isModal, askConfirm }: SessionListProps) => {

    return (
        <div className="flex flex-col h-full">
            {!isModal && (
                <>
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
                    <div className="flex items-center justify-between mb-2">
                        {onExpand ? (
                            <button
                                onClick={onExpand}
                                className="text-[10px] font-bold text-slate-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-1 transition-colors group p-2 -ml-2 -my-2 cursor-pointer"
                                title="Expand Sessions Viewer"
                            >
                                <Icon name="expand-arrows-alt" className="opacity-0 group-hover:opacity-100 transition-all group-hover:scale-110" />
                                Neural Sessions
                            </button>
                        ) : (
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Sessions</label>
                        )}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onImport}
                                className="w-7 h-7 flex items-center justify-center text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-all"
                                title="Import Session"
                            >
                                <Icon name="download" className="text-[11px]" />
                            </button>
                            <button
                                onClick={onNew}
                                className="w-7 h-7 flex items-center justify-center text-blue-400 hover:bg-blue-400/10 rounded-md transition-all"
                                title="New Session"
                            >
                                <Icon name="plus" className="text-[11px]" />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />
                </>
            )}

            <div className={`flex-1 overflow-y-auto custom-scrollbar pr-1 ${isModal ? 'space-y-2' : 'space-y-1'}`}>
                {loading && sessions.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 animate-pulse">
                        <Icon name="spinner" className="animate-spin mb-1" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                        <p className={`${isModal ? 'text-sm' : 'text-[10px]'} text-slate-600`}>No active history found</p>
                    </div>
                ) : (
                    sessions.map(ss => (
                        <div
                            key={ss.id}
                            className={`group relative flex flex-col gap-1.5 rounded-xl transition-all duration-200 cursor-pointer ${isModal ? 'p-4' : 'p-2.5'} ${currentSessionId === ss.id
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-900/10'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                            onClick={() => onSelect(ss.id)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className={`${isModal ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full shrink-0 ${currentSessionId === ss.id ? 'bg-blue-400 shadow-glow' : 'bg-slate-700'}`} />
                                <div className={`${isModal ? 'text-sm' : 'text-xs'} font-medium truncate flex-1`}>{ss.title || 'Untitled Session'}</div>
                            </div>

                            <div className="flex items-center justify-between pl-5 w-full">
                                <div className={`${isModal ? 'text-[11px]' : 'text-[9px]'} text-slate-500 font-mono truncate`}>
                                    {ss.messageCount} messages • {new Date(ss.lastModified).toLocaleDateString()}
                                </div>

                                <div className={`flex items-center gap-2 ${isModal ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExport(ss.id);
                                        }}
                                        className={`${isModal ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all`}
                                        title="Export session"
                                    >
                                        <Icon name="upload" className={`${isModal ? 'text-sm' : 'text-[10px]'}`} />
                                    </button>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (await askConfirm('Delete this session?', 'left')) onDelete(ss.id);
                                        }}
                                        className={`${isModal ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all`}
                                        title="Delete session"
                                    >
                                        <Icon name="times" className={`${isModal ? 'text-sm' : 'text-[10px]'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});
