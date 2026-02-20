import React, { useState } from 'react';
import { AppState, Provider, SessionMetadata } from '../../types';
import { PROVIDERS } from '../../constants';
import { Icon } from '../common/Common';
import { SessionList } from '../features/SessionList';
import { getRandomSignature } from '../../utils/easterEgg';

interface SidebarProps {
    state: AppState & {
        onDeleteSession: (id: string) => void;
        onNewSession: () => void;
        onExportSession: (id: string) => void;
        onImportSession: () => void;
        askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    };
    sessions: SessionMetadata[];
    loadingSessions: boolean;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    onClear: () => void;
}
export const Sidebar = React.memo(({ state, sessions, loadingSessions, setState, onClear }: SidebarProps) => {
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setSessionModalOpen(false);
            setIsClosing(false);
        }, 400);
    };

    const [displayName, setDisplayName] = useState('mikuCentral');
    const [isAnimatingEgg, setIsAnimatingEgg] = useState(false);

    const triggerEasterEgg = () => {
        if (isAnimatingEgg) return;
        setIsAnimatingEgg(true);

        const original = "mikuCentral";
        const signature = `{{${getRandomSignature()}}}`;

        // 1. Expansion Phase (mikuCentral -> {{ }})
        const expansionSteps = [

            "mikuCentral",
            "miku|entral",
            "mik|ntral",
            "mi|tral",
            "m|ral",
            "|al",
            "{}l",
            "{{}}",
            "{{}}H",
            "{{}}HI",
            "{{}}-HI!",
            "{{}}--HI!",
            "{{}}-HI!",
            "{{}}HI!",
            "{{}}I!",
            "{{}}!",
            "{{}}",
            "{}"
        ];

        let delay = 0;
        expansionSteps.forEach((step, i) => {
            setTimeout(() => setDisplayName(step), delay);
            delay += 70;
        });

        // 2. Typing/Revealing Phase
        const fullContent = signature.slice(2, -2); // Get "EMOJI FACE EMOJI"
        for (let i = 0; i <= fullContent.length; i++) {
            setTimeout(() => {
                const currentContent = fullContent.slice(0, i);
                setDisplayName(`{{${currentContent}}}`);
            }, delay);
            delay += 50;
        }

        // 3. Reverse Phase
        setTimeout(() => {
            // Reverse Typing
            let reverseDelay = 0;
            for (let i = fullContent.length; i >= 0; i--) {
                setTimeout(() => {
                    const currentContent = fullContent.slice(0, i);
                    setDisplayName(`{{${currentContent}}}`);
                }, reverseDelay);
                reverseDelay += 30;
            }

            // Reverse Expansion (Shrink back to name)
            const shrinkSteps = [
                "|",
                "{}",
                "{{}}",
                "{{}}l",
                "m{{}}al",
                "mi{{}}ral",
                "mik{{}}tral",
                "miku{}ntral",
                "miku|entral",
                "mikuCentral"
            ];

            shrinkSteps.forEach((step, i) => {
                setTimeout(() => setDisplayName(step), reverseDelay);
                reverseDelay += 70;
            });

            setTimeout(() => {
                setIsAnimatingEgg(false);
            }, reverseDelay);

        }, delay + 3000);
    };

    return (
        <>
            <div className="bg-slate-900 border-r border-slate-700 flex flex-col h-full shadow-xl z-30 w-[72px] lg:w-64 flex-shrink-0 transition-all duration-300">
                <div className="p-4 lg:p-6">
                    <div className="flex items-center justify-center lg:justify-start gap-3 mb-8 group cursor-default h-10 overflow-hidden w-full px-1">
                        <div
                            className="w-10 h-10 rounded-xl bg-slate-800 flex flex-shrink-0 items-center justify-center shadow-md group-hover:scale-110 active:scale-95 transition-all duration-300 overflow-hidden border border-slate-700/50 cursor-pointer"
                            onClick={triggerEasterEgg}
                        >
                            <img src="/mikuBotICON.png" alt="Miku Logo" className="w-full h-full object-cover shadow-inner" />
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <h1 className={`font-bold text-lg text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isAnimatingEgg ? 'text-blue-400 font-mono text-sm' : ''}`}>
                                {displayName}
                            </h1>
                            <div className="text-[11px] text-slate-500/80 font-bold uppercase tracking-[0.2em] leading-tight mt-0.5">v1.3.0</div>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {[
                            { id: 'chat', label: 'Neural Chat', icon: 'comments', color: 'text-blue-400' },
                            { id: 'cortex', label: 'Cortex Editor', icon: 'project-diagram', color: 'text-indigo-400' },
                            { id: 'commands', label: 'Command Editor', icon: 'bolt', color: 'text-amber-400' },
                            { id: 'settings', label: 'Control Room', icon: 'cog', color: 'text-slate-400' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setState(prev => ({ ...prev, activeTab: tab.id as any, selectedFile: '' }))}
                                className={`w-full flex items-center justify-center lg:justify-start gap-4 px-0 lg:px-4 py-3.5 rounded-xl transition-all duration-200 group border active:scale-95 ${state.activeTab === tab.id
                                    ? 'bg-slate-800 text-white shadow-md border-slate-700'
                                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                    }`}
                            >
                                <Icon name={tab.icon} className={`text-2xl lg:text-lg flex-shrink-0 ${state.activeTab === tab.id ? tab.color : 'group-hover:text-slate-300'} transition-colors`} />
                                <span className="hidden lg:inline text-base font-bold tracking-wide truncate">{tab.label}</span>
                                {state.activeTab === tab.id && (
                                    <div className={`hidden lg:block ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${tab.color.replace('text', 'bg')} shadow-glow`} />
                                )}
                            </button>
                        ))}

                        {/* Mobile Sessions Button */}
                        <button
                            onClick={() => setSessionModalOpen(true)}
                            className={`w-full flex items-center justify-center lg:hidden gap-3 px-0 py-3.5 mt-4 rounded-xl transition-all duration-200 group border border-transparent active:scale-95 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50`}
                            title="Neural Sessions"
                        >
                            <Icon name="history" className={`text-2xl flex-shrink-0 group-hover:text-slate-300 transition-colors`} />
                        </button>

                        {/* Mobile Context Library Button */}
                        <button
                            onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                            className={`w-full flex items-center justify-center lg:hidden gap-3 px-0 py-3.5 mt-2 rounded-xl transition-all duration-200 group border border-transparent active:scale-95 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50`}
                            title="Context Library"
                        >
                            <Icon name="book" className={`text-2xl flex-shrink-0 group-hover:text-pink-400 transition-colors`} />
                        </button>
                    </nav>
                </div>

                <div className="flex-1 overflow-hidden hidden lg:flex flex-col min-h-0">
                    <div className="px-5 py-4 flex-1 flex flex-col min-h-0">
                        <SessionList
                            sessions={sessions}
                            loading={loadingSessions}
                            currentSessionId={state.sessionId}
                            onSelect={(id) => (state as any).onSelectSession(id)}
                            onDelete={(id) => (state as any).onDeleteSession(id)}
                            onNew={() => (state as any).onNewSession()}
                            onExport={(id) => (state as any).onExportSession(id)}
                            onImport={() => (state as any).onImportSession()}
                            onExpand={() => setSessionModalOpen(true)}
                            askConfirm={state.askConfirm}
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
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Context Library</label>
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
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono truncate flex items-center gap-2 transition-colors border active:scale-95 ${isSelected
                                                ? 'bg-blue-900/20 text-blue-300 border-blue-700/30'
                                                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800'
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

            {/* Deep Session Modal (Available on Mobile & Desktop) */}
            {sessionModalOpen && (
                <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={handleClose} />
                    <div className={`relative w-full max-w-2xl bg-slate-950 border border-slate-700 shadow-2xl flex flex-col rounded-2xl overflow-hidden h-[85vh] sm:h-[75vh] ${isClosing ? 'animate-macos-shrink-left' : 'animate-macos-expand-left'}`}>
                        {/* Header */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                                    <Icon name="history" className="text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">Neural Sessions</h2>
                                    <p className="text-xs text-slate-500">Manage, load and branch conversation states</p>
                                </div>
                            </div>
                            <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">
                                <Icon name="times" />
                            </button>
                        </div>
                        {/* Body */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-950 p-4 sm:p-6 pb-0">
                            <SessionList
                                sessions={sessions}
                                loading={loadingSessions}
                                currentSessionId={state.sessionId}
                                onSelect={(id) => { (state as any).onSelectSession(id); handleClose(); }}
                                onDelete={(id) => (state as any).onDeleteSession(id)}
                                onNew={() => { (state as any).onNewSession(); handleClose(); }}
                                onExport={(id) => (state as any).onExportSession(id)}
                                onImport={() => { (state as any).onImportSession(); handleClose(); }}
                                onExpand={() => setSessionModalOpen(true)}
                                askConfirm={state.askConfirm}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});
