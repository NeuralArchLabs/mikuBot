import React, { useState } from 'react';
import { AppState, SessionMetadata } from '../../types';
import { Icon } from '../common/Common';
import { SessionList } from '../features/SessionList';
import { getRandomSignature } from '../../utils/easterEgg';

interface SidebarProps {
    state: AppState & {
        onDeleteSession: (id: string) => void;
        onNewSession: () => void;
        onExportSession: (id: string) => void;
        onImportSession: () => void;
        onDeleteFile: (name: string, target: 'core' | 'extra' | 'workSpace' | 'tools') => Promise<boolean>;
        onAddFile: (name: string, target: 'core' | 'extra' | 'workSpace' | 'tools') => Promise<void>;
        askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    };
    sessions: SessionMetadata[];
    loadingSessions: boolean;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    onClear: () => void;
    triggerNeuralEgg?: number;
}
export const Sidebar = React.memo(({ state, sessions, loadingSessions, setState, onClear, triggerNeuralEgg }: SidebarProps) => {
     const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);

    React.useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isCompactMode = windowHeight < 650;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setSessionModalOpen(false);
            setIsClosing(false);
        }, 400);
    };

    const [displayName, setDisplayName] = useState('mikuCentral');
    const [isAnimatingEgg, setIsAnimatingEgg] = useState(false);

    // Auto-trigger egg on scheduled tasks
    React.useEffect(() => {
        if (triggerNeuralEgg && triggerNeuralEgg > 0 && !isAnimatingEgg) {
            triggerEasterEgg();
        }
    }, [triggerNeuralEgg]);

    const triggerEasterEgg = () => {
        if (isAnimatingEgg) return;
        setIsAnimatingEgg(true);

        const original = "mikuCentral";
        const signature = `{{${getRandomSignature()}}}`;

        // 1. Expansion Phase (mikuCentral -> {{ }})
        const expansionSteps = [

            "mikuCentral",
            "miku|entral",
            "miku\\entral",
            "miku-entral",
            "miku/entral",
            "miku|entral",
            "miku\\entral",
            "miku-entral",
            "miku/entral",
            "miku|entral",
            "miku\\ntral",
            "mi-tral",
            "m/ral",
            "|al",
            "{}l",
            "{{}}",
            "{{}}/",
            "{{}}--",
            "{{}}-\\",
            "{{}}--H-",
            "{{}}--HI",
            "{{}}--HI!",
            "{{}}--HI!",
            "{{}}--HI!",
            "{{}}--HI!",
            "{{}}--HI\\",
            "{{}}--H-",
            "{{}}--/",
            "{{}}-|",
            "{{}\\",
            "{{}-",
            "{{/",
            "{|",
            "\\",
            "-",
            "/",
            "|",
            "\\",
            "-",
            "/",
            "|",
            "{"
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
                "/{{}}a\\",
                "m-{{}}r-l",
                "mi\\{{}}t/al",
                "mik|{}n|}al",
                "mik{/e\\}ral",
                "mi{u--nt}al",
                "m{ku\\entr}l",
                "{iku|entra}",
                "miku/entral}",
                "miku-entral\\",
                "miku\\entral|",
                "miku|entral/",
                "miku/entral-",
                "mikuCentral",
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
            <div className="bg-slate-900 flex flex-col h-full shadow-xl z-30 w-16 lg:w-68 flex-shrink-0 transition-all duration-300 relative overflow-hidden custom-scrollbar miku-sidebar-isolate">
                {/* Vertical Gradient Border (Fade in from top) */}
                <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/50 via-[8%] to-slate-700/50 pointer-events-none" />
                
                {/* Top Section: Logo & Main Nav */}
                <div className="flex-none p-3 lg:p-6 pb-0 flex flex-col h-full lg:h-auto">
                    <div className="flex items-center justify-center lg:justify-start gap-3 mb-8 group cursor-default h-10 overflow-visible w-full px-1">
                        <div
                            className="w-10 h-10 rounded-xl bg-slate-800 flex flex-shrink-0 items-center justify-center shadow-md group-hover:scale-110 active:scale-95 transition-all duration-300 overflow-hidden border border-slate-700/50 cursor-pointer relative z-10"
                            onClick={triggerEasterEgg}
                        >
                            <img src="./mikuBotICON.png" alt="Miku Logo" className="w-full h-full object-cover shadow-inner" />
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <h1 className={`font-bold text-lg text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isAnimatingEgg ? 'text-blue-400 font-mono text-sm' : ''}`}>
                                {displayName}
                            </h1>
                            <div className="text-[11px] text-slate-500/80 font-bold uppercase tracking-[0.2em] leading-tight mt-0.5">v1.9.7</div>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {[
                            { id: 'chat', label: 'Neural Chat', icon: 'comments', color: 'text-blue-400' },
                            { id: 'cortex', label: 'Cortex Editor', icon: 'project-diagram', color: 'text-indigo-400' },
                            { id: 'commands', label: 'Command Editor', icon: 'bolt', color: 'text-amber-400' },
                            { id: 'scheduler', label: 'Neural Tasks', icon: 'clock', color: 'text-cyan-400' },
                            { id: 'settings', label: 'Control Room', icon: 'cog', color: 'text-purple-400' }
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
                                <span className="hidden lg:inline text-base font-bold tracking-tight whitespace-nowrap">{tab.label}</span>
                                {state.activeTab === tab.id && (
                                    <div className={`hidden lg:block ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${tab.color.replace('text', 'bg')} shadow-glow`} />
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Mobile Contents Toggle (Bottom Fixed on Mobile) */}
                    <div className="lg:hidden mt-auto pt-6 space-y-3 pb-8">
                         <div className="h-px bg-slate-800/50 mb-6" />
                         <button
                            onClick={() => setSessionModalOpen(true)}
                            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-500/20 transition-all active:scale-90"
                            title="Neural Sessions"
                        >
                            <Icon name="history" />
                        </button>
                        <button
                            onClick={() => setState(p => ({ ...p, isLibraryExpanded: true }))}
                            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 hover:border-indigo-500/20 transition-all active:scale-90"
                            title="Context Library"
                        >
                            <Icon name="book" />
                        </button>
                    </div>
                </div>

                {/* Bottom Balanced Section (Sessions + Library - Desktop Only) */}
                <div className="flex-1 hidden lg:flex flex-col min-h-0 overflow-hidden">
                    
                    {/* Neural Sessions - Dynamic Growth or Compact Tab */}
                    <div className={`${isCompactMode ? 'flex-none h-14' : 'flex-[1.2] min-h-[140px]'} flex flex-col overflow-hidden px-5 pt-0 transition-all duration-300`}>
                        <div className={isCompactMode ? 'hover:bg-blue-500/5 rounded-xl transition-all cursor-pointer' : ''} onClick={isCompactMode ? () => setSessionModalOpen(true) : undefined}>
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
                                hideList={isCompactMode}
                            />
                        </div>
                    </div>

                    {/* Context Library - Balanced (flex-1) or Compact Tab */}
                    <div className={`${isCompactMode ? 'flex-none h-14' : 'flex-1 min-h-0'} flex flex-col border-t border-slate-800/40 shadow-[0_-10px_15px_-5px_rgba(0,0,0,0.3)] transition-all duration-300`}>
                        <div 
                            className={`px-5 py-3 flex-1 flex flex-col min-h-0 ${isCompactMode ? 'hover:bg-slate-800/40 cursor-pointer rounded-xl mx-2 my-1' : ''}`}
                            onClick={isCompactMode ? () => setState(p => ({ ...p, isLibraryExpanded: true })) : undefined}
                        >
                             <div className="flex items-center justify-between flex-none mb-2">
                                <button
                                    onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                                    className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-400 uppercase tracking-[0.18em] flex items-center gap-1.5 transition-colors group cursor-pointer"
                                    title="Expand Library Viewer"
                                >
                                    <Icon name="book" className="text-[9px] opacity-30 group-hover:opacity-100 transition-all" />
                                    Context Library
                                </button>
                                {!isCompactMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); (state as any).onAddFile(`Doc_${Date.now()}.md`, 'extra'); }}
                                        className="text-slate-500 hover:text-indigo-400 transition-colors p-1 px-2 cursor-pointer group"
                                        title="New Context Document"
                                    >
                                        <Icon name="plus" className="text-[10px] group-hover:scale-110 transition-transform" />
                                    </button>
                                )}
                             </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 via-[5%] to-transparent flex-none" />
 
                            {!isCompactMode && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pb-3 min-h-0">
                                    {Object.keys(state.additionalFiles || {}).length === 0 ? (
                                        <div className="text-center py-6 px-2 border border-dashed border-slate-800/50 rounded-xl bg-slate-800/10">
                                            <p className="text-[9px] text-slate-600 italic">No cortex expansion</p>
                                        </div>
                                    ) : (
                                        Object.keys(state.additionalFiles || {}).map(filename => {
                                            const isSelected = (state.selectedLibraryFiles || []).includes(filename);
                                            return (
                                                <div key={filename} className="group relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setState(prev => {
                                                                const current = prev.selectedLibraryFiles || [];
                                                                const updated = isSelected ? current.filter(f => f !== filename) : [...current, filename];
                                                                return { ...prev, selectedLibraryFiles: updated };
                                                            });
                                                        }}
                                                        className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-mono truncate flex items-center gap-2.5 transition-all border ${isSelected
                                                            ? 'bg-blue-600/15 text-blue-300 border-blue-500/30'
                                                            : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                                                            }`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-400 shadow-glow' : 'bg-slate-700'}`} />
                                                        <span className="truncate pr-5">{filename}</span>
                                                    </button>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (await state.askConfirm(`Delete ${filename}?`, 'right')) {
                                                                await state.onDeleteFile(filename, 'extra');
                                                            }
                                                        }}
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                                                    >
                                                        <Icon name="times" className="text-[9px]" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
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
                                    <h2 className="text-lg font-bold text-white tracking-wider">Session Manager</h2>
                                    <p className="text-xs text-slate-500">Manage, load and branch conversation states</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { (state as any).onImportSession(); handleClose(); }}
                                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                    title="Import Session"
                                >
                                    <Icon name="download" /> Import
                                </button>
                                <button
                                    onClick={() => { (state as any).onNewSession(); handleClose(); }}
                                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                    title="New Session"
                                >
                                    <Icon name="plus" /> New
                                </button>
                                <div className="w-px h-6 bg-slate-800 mx-1" />
                                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title="Close Session Manager">
                                    <Icon name="times" />
                                </button>
                            </div>
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
                                isModal={true}
                                askConfirm={state.askConfirm}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});
