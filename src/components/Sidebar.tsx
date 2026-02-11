import React from 'react';
import { AppState, Provider } from '../types';
import { PROVIDERS } from '../constants';
import { Icon } from './Common';
import { SessionList } from './SessionList';

interface SidebarProps {
    state: AppState & {
        onSelectSession: (id: string) => void;
        onDeleteSession: (id: string) => void;
        onNewSession: () => void;
    };
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    onClear: () => void;
}

export const Sidebar = React.memo(({ state, setState, onClear }: SidebarProps) => {
    return (
        <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full shadow-xl z-20">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Icon name="brain" className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white tracking-tight">mikuCentral</h1>
                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">v.1.0-alpha</div>
                    </div>
                </div>

                <nav className="space-y-1">
                    {[
                        { id: 'chat', label: 'Neural Chat', icon: 'comments', color: 'text-blue-400' },
                        { id: 'cortex', label: 'Cortex Editor', icon: 'project-diagram', color: 'text-indigo-400' },
                        { id: 'settings', label: 'Control Room', icon: 'cog', color: 'text-slate-400' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setState(prev => ({ ...prev, activeTab: tab.id as any }))}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${state.activeTab === tab.id
                                ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Icon name={tab.icon} className={`text-base ${state.activeTab === tab.id ? tab.color : 'group-hover:text-slate-300'} transition-colors`} />
                            <span className="text-sm font-medium">{tab.label}</span>
                            {state.activeTab === tab.id && (
                                <div className={`ml-auto w-1.5 h-1.5 rounded-full ${tab.color.replace('text', 'bg')} shadow-glow`} />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="px-5 py-4 flex-1 flex flex-col min-h-0">
                    <SessionList
                        currentSessionId={state.sessionId}
                        onSelect={(id) => (state as any).onSelectSession(id)}
                        onDelete={(id) => (state as any).onDeleteSession(id)}
                        onNew={() => (state as any).onNewSession()}
                    />
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-900/40">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">System Engine</div>
                    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-2 h-2 rounded-full ${state.config.model ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm animate-pulse' : 'bg-slate-600'}`} />
                            <span className="text-xs text-slate-300 font-medium truncate">
                                {state.config.model ? (state.config.model.split('/').pop()) : 'Offline'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-500">{PROVIDERS[state.config.provider].name}</span>
                            <div className="px-1.5 py-0.5 rounded bg-slate-700 text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Active</div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-900/60">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Library Context</label>
                        <button
                            onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        >
                            <Icon name="expand-alt" /> Manage
                        </button>
                    </div>

                    {Object.keys(state.additionalFiles || {}).length === 0 ? (
                        <div className="text-center py-3 px-2 border border-dashed border-slate-700 rounded-xl bg-slate-800/10">
                            <p className="text-[10px] text-slate-600 mb-2">No cortex expansion</p>
                            <div
                                className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer flex items-center justify-center gap-1 font-medium"
                                onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
                            >
                                <Icon name="plus-circle" /> Link Data
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {Object.keys(state.additionalFiles || {}).map(filename => {
                                const isSelected = (state.selectedLibraryFiles || []).includes(filename);
                                return (
                                    <button
                                        key={filename}
                                        onClick={() => {
                                            setState(prev => {
                                                const current = prev.selectedLibraryFiles || [];
                                                const updated = isSelected
                                                    ? current.filter(f => f !== filename)
                                                    : [...current, filename];
                                                return { ...prev, selectedLibraryFiles: updated };
                                            });
                                        }}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono truncate flex items-center gap-2 transition-colors ${isSelected
                                            ? 'bg-blue-900/20 text-blue-300 border border-blue-700/30'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                            }`}
                                    >
                                        <Icon name={isSelected ? 'check-circle' : 'circle'} className="flex-shrink-0 text-[10px]" />
                                        <span className="truncate">{filename}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
});
