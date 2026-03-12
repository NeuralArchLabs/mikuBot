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
            <div className="bg-slate-900 border-r border-slate-700 flex flex-col h-full shadow-xl z-30 w-16 lg:w-68 flex-shrink-0 transition-all duration-300 overflow-y-auto overflow-x-hidden custom-scrollbar miku-sidebar-isolate">
                <div className="p-3 lg:p-6">
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
                            <div className="text-[11px] text-slate-500/80 font-bold uppercase tracking-[0.2em] leading-tight mt-0.5">v1.9.5</div>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

                    <nav className="space-y-1">
                        {[
                            { id: 'chat', label: 'Neural Chat', icon: 'comments', color: 'text-blue-400' },
                            { id: 'cortex', label: 'Cortex Editor', icon: 'project-diagram', color: 'text-indigo-400' },
                            { id: 'commands', label: 'Command Editor', icon: 'bolt', color: 'text-amber-400' },
                            { id: 'skills', label: 'Neural Skills', icon: 'puzzle-piece', color: 'text-cyan-400' },
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

                    {/* Collapsed Sidebar Separator */}
                    <div className="lg:hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />

                    <nav className="space-y-1">
                        {/* Mobile Sessions Button */}
                        <button
                            onClick={() => setSessionModalOpen(true)}
                            className={`w-10 h-10 mx-auto flex items-center justify-center lg:hidden rounded-full transition-all duration-300 group bg-slate-800/40 border border-slate-700/50 active:scale-90 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer mt-2`}
                            title="Neural Sessions"
                        >
                            <Icon name="history" className={`text-xl flex-shrink-0 transition-colors pointer-events-none`} />
                        </button>

                        {/* Mobile Library Separator */}
                        <div className="lg:hidden h-px bg-gradient-to-r from-transparent via-white/5 to-transparent my-3" />

                        {/* Mobile Context Library Button */}
                        <button
                            onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                            className={`w-10 h-10 mx-auto flex items-center justify-center lg:hidden rounded-full transition-all duration-300 group bg-slate-800/40 border border-slate-700/50 active:scale-90 text-slate-400 hover:text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/30 hover:shadow-[0_0_15px_rgba(236,72,153,0.2)] cursor-pointer`}
                            title="Context Library"
                        >
                            <Icon name="book" className={`text-xl flex-shrink-0 transition-colors pointer-events-none`} />
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


                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="p-4 bg-slate-900/60">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Context Library</label>
                            <button
                                onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors -mr-2 -my-2 p-2 px-3 cursor-pointer group"
                            >
                                <Icon name="expand-alt" className="group-hover:scale-110 transition-transform" /> Manage
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
                            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {Object.keys(state.additionalFiles || {}).map(filename => {
                                    const isSelected = (state.selectedLibraryFiles || []).includes(filename);
                                    return (
                                        <div key={filename} className="group relative">
                                            <button
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
                                                <span className="truncate pr-6">{filename}</span>
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (await state.askConfirm(`Permanently delete ${filename} from Context Library?`, 'right')) {
                                                        await state.onDeleteFile(filename, 'extra');
                                                    }
                                                }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                                                title="Delete file"
                                            >
                                                <Icon name="times" className="text-[10px]" />
                                            </button>
                                        </div>
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
                                    <h2 className="text-lg font-bold text-white tracking-wider">Session Manager</h2>
                                    <p className="text-xs text-slate-500">Manage, load and branch conversation states</p>
                                </div>
                            </div>
                            <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title="Close Session Manager">
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
