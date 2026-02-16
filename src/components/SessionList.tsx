import React, { useEffect, useState } from 'react';
import { SessionMetadata } from '../types';
import { persistence } from '../services/persistence';
import { Icon } from './Common';

interface SessionListProps {
    sessions: SessionMetadata[];
    loading: boolean;
    currentSessionId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    onExport: (id: string) => void;
    onImport: () => void;
}

export const SessionList = ({ sessions, loading, currentSessionId, onSelect, onDelete, onNew, onExport, onImport }: SessionListProps) => {

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Sessions</label>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onImport}
                        className="p-1 px-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors flex items-center gap-1"
                        title="Import Session"
                    >
                        <Icon name="download" className="text-[10px]" />
                    </button>
                    <button
                        onClick={onNew}
                        className="p-1 px-1.5 text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors flex items-center gap-1"
                        title="New Session"
                    >
                        <Icon name="plus" className="text-[10px]" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {loading && sessions.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 animate-pulse">
                        <Icon name="spinner" className="animate-spin mb-1" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                        <p className="text-[10px] text-slate-600">No active history</p>
                    </div>
                ) : (
                    sessions.map(ss => (
                        <div
                            key={ss.id}
                            className={`group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-200 cursor-pointer ${currentSessionId === ss.id
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                            onClick={() => onSelect(ss.id)}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentSessionId === ss.id ? 'bg-blue-400 shadow-glow' : 'bg-slate-700'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{ss.title || 'Untitled Session'}</div>
                                <div className="text-[9px] text-slate-500 font-mono truncate">
                                    {ss.messageCount} msgs • {new Date(ss.lastModified).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExport(ss.id);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-indigo-400"
                                    title="Export session"
                                >
                                    <Icon name="upload" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Delete this session?')) onDelete(ss.id);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-red-400"
                                    title="Delete session"
                                >
                                    <Icon name="times" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
