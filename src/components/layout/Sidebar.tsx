import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, SessionMetadata } from '../../types';
import { Icon } from '../common/Common';
import { SessionList } from '../features/SessionList';
import { getRandomSignature } from '../../utils/easterEgg';
import { APP_VERSION } from '../../constants/config';

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
     const { t } = useTranslation();
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
            <div className="bg-slate-900 flex flex-col h-full shadow-xl z-30 w-16 lg:w-68 flex-shrink-0 transition-all duration-300 relative overflow-y-auto custom-scrollbar miku-sidebar-isolate">
                {/* Vertical Gradient Border (Fade in from top) */}
                <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/50 via-[8%] to-slate-700/50 pointer-events-none" />
                
                {/* Top Section: Logo & Main Nav */}
                <div className={`flex-none p-3 lg:p-6 pb-0 flex flex-col ${isCompactMode ? 'min-h-0' : 'min-h-full lg:min-h-0'} lg:h-auto`}>
                    <div className={`flex items-center justify-center lg:justify-start gap-3 ${isCompactMode ? 'mb-4' : 'mb-8'} group cursor-default h-10 overflow-visible w-full px-1 relative`}>
                        <div
                            className="w-10 h-10 rounded-xl bg-slate-800 flex flex-shrink-0 items-center justify-center shadow-md group-hover:scale-110 active:scale-95 transition-all duration-300 overflow-hidden border border-slate-700/50 cursor-pointer relative z-10 premium-button"
                            onClick={triggerEasterEgg}
                        >
                            <img src="./mikuBotICON.png" alt="Miku Logo" className="w-full h-full object-cover shadow-inner" />
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <h1 className={`font-bold text-lg text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isAnimatingEgg ? 'text-blue-400 font-mono text-sm' : ''}`}>
                                {displayName}
                            </h1>
                            <div className="text-[11px] text-slate-500/80 font-bold uppercase tracking-[0.2em] leading-tight mt-0.5">v{APP_VERSION}</div>
                        </div>
                        {/* Glowy aesthetic separator (absolute, no displacement) */}
                        <div className="absolute left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-700/40 to-transparent -bottom-4 pointer-events-none">
                            <div className="absolute inset-0 h-full bg-gradient-to-r from-transparent via-blue-400/10 to-transparent blur-[2px] opacity-50" />
                        </div>
                    </div>

                    <nav className="space-y-1 relative">
                        {/* Dynamic Sliding Indicator Dot Wrapper */}
                        {(() => {
                            const navTabs = [
                                { id: 'chat', label: t('sidebar.tabs.chat'), icon: 'comments', color: 'text-blue-400', bg: 'bg-blue-400', hex: '#60a5fa' },
                                { id: 'cortex', label: t('sidebar.tabs.cortex'), icon: 'project-diagram', color: 'text-indigo-400', bg: 'bg-indigo-400', hex: '#818cf8' },
                                { id: 'commands', label: t('sidebar.tabs.commands'), icon: 'bolt', color: 'text-amber-400', bg: 'bg-amber-400', hex: '#fbbf24' },
                                { id: 'scheduler', label: t('sidebar.tabs.scheduler'), icon: 'clock', color: 'text-cyan-400', bg: 'bg-cyan-400', hex: '#22d3ee' },
                                { id: 'settings', label: t('sidebar.tabs.settings'), icon: 'cog', color: 'text-purple-400', bg: 'bg-purple-400', hex: '#c084fc' }
                            ];
                            const activeIndex = navTabs.findIndex(t => t.id === state.activeTab);
                            const activeTab = navTabs[activeIndex] || navTabs[0];

                            return (
                                <>
                                    {/* The sliding carriage that holds the dot */}
                                    <div 
                                        className="hidden lg:block absolute right-0 left-0 w-full pointer-events-none z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                        style={{ 
                                            height: `${isCompactMode ? 44 : 53}px`,
                                            transform: `translateY(${activeIndex * (isCompactMode ? 48 : 57)}px)` 
                                        }}
                                    >
                                        <div 
                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-glow transition-colors duration-500"
                                            style={{ backgroundColor: activeTab.hex }}
                                        />
                                    </div>

                                    {navTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setState(prev => ({ ...prev, activeTab: tab.id as any, selectedFile: '' }))}
                                            className={`w-full flex items-center justify-center lg:justify-start gap-4 px-3 lg:px-4 rounded-xl transition-all duration-300 group premium-button border ${state.activeTab === tab.id
                                                ? 'bg-slate-800 text-white shadow-md border-slate-800 shadow-blue-500/5'
                                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                                } hover:border-slate-700/50`}
                                            style={{ height: `${isCompactMode ? 44 : 53}px` }}
                                            title={tab.label}
                                        >
                                            <Icon name={tab.icon} className={`${isCompactMode ? 'text-xl lg:text-base' : 'text-2xl lg:text-lg'} flex-shrink-0 ${state.activeTab === tab.id ? tab.color : 'group-hover:text-slate-300'} transition-colors`} />
                                            <span className={`hidden lg:inline-block flex-1 text-left ${isCompactMode ? 'text-sm' : 'text-base'} font-bold tracking-tight truncate whitespace-nowrap`}>{tab.label}</span>
                                        </button>
                                    ))}
                                </>
                            );
                        })()}
                    </nav>

                    {/* Mobile Contents Toggle (Bottom Fixed on Mobile) */}
                    <div className={`lg:hidden mt-auto ${isCompactMode ? 'pt-2 pb-4' : 'pt-6 pb-8'} space-y-3`}>
                         <div className="h-px bg-slate-800/50 mb-6" />
                         <button
                            onClick={() => setSessionModalOpen(true)}
                            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 hover:border-blue-500/20 transition-all active:scale-90"
                            title={t('sidebar.tooltips.sessions')}
                        >
                            <Icon name="history" />
                        </button>
                        <button
                            onClick={() => setState(p => ({ ...p, isLibraryExpanded: true }))}
                            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 hover:border-indigo-500/20 transition-all active:scale-90"
                            title={t('sidebar.tooltips.library')}
                        >
                            <Icon name="book" />
                        </button>
                    </div>
                </div>

                {/* Bottom Balanced Section (Sessions + Library - Desktop Only) */}
                <div className="flex-1 hidden lg:flex flex-col min-h-0 overflow-hidden">
                    
                    {/* Neural Sessions - Dynamic Growth or Compact Tab */}
                    <div className={`${isCompactMode ? 'flex-1' : 'flex-[1.2]'} flex flex-col overflow-hidden px-5 pt-0 transition-all duration-300 min-h-0`}>
                        <div className={`${isCompactMode ? 'hover:bg-blue-500/5 rounded-xl transition-all h-full' : 'flex-1 min-h-0'}`}>
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
                                hideList={false}
                            />
                        </div>
                    </div>

                    {/* Context Library - Balanced (flex-1) or Compact Tab */}
                    <div className="flex-1 flex flex-col border-t border-slate-800/40 shadow-[0_-10px_15px_-5px_rgba(0,0,0,0.3)] transition-all duration-300 min-h-0">
                        <div 
                            className={`px-5 py-3 flex-1 flex flex-col min-h-0 ${isCompactMode ? 'hover:bg-slate-800/40 rounded-xl mx-2 my-1' : ''}`}
                        >
                             <div className="flex items-center justify-between flex-none mb-2">
                                <button
                                    onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
                                    className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-400 uppercase tracking-[0.18em] flex items-center gap-1.5 transition-colors group cursor-pointer"
                                    title={t('sidebar.tooltips.expand_library')}
                                >
                                    <Icon name="book" className="text-[9px] opacity-30 group-hover:opacity-100 transition-all" />
                                    {t('sidebar.tooltips.library')}
                                </button>
                                {!isCompactMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); (state as any).onAddFile(`Doc_${Date.now()}.md`, 'extra'); }}
                                        className="text-slate-500 hover:text-indigo-400 transition-colors p-1 px-2 cursor-pointer group"
                                        title={t('sidebar.tooltips.new_doc')}
                                    >
                                        <Icon name="plus" className="text-[10px] group-hover:scale-110 transition-transform" />
                                    </button>
                                )}
                             </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 via-[5%] to-transparent flex-none" />
 
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pt-3 pb-3 min-h-0">
                                    {Object.keys(state.additionalFiles || {}).length === 0 ? (
                                        <div className="text-center py-6 px-2 border border-dashed border-slate-800/50 rounded-xl bg-slate-800/10">
                                            <p className="text-[9px] text-slate-600 italic">{t('sidebar.footer.no_cortex')}</p>
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
                                                        className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-mono truncate flex items-center gap-2.5 transition-all duration-300 border border-transparent ${isSelected
                                                            ? 'bg-blue-600/15 text-blue-300'
                                                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                                                            } hover:border-blue-500/50 hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-400 shadow-glow' : 'bg-slate-700'}`} />
                                                        <span className="truncate pr-5">{filename}</span>
                                                    </button>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (await state.askConfirm(t('sidebar.tooltips.delete_file', { filename }), 'right')) {
                                                                await state.onDeleteFile(filename, 'extra');
                                                            }
                                                        }}
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                                                        title={t('sidebar.tooltips.delete_file', { filename })}
                                                    >
                                                        <Icon name="times" className="text-[9px]" />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                    <div className="h-4 w-full flex-shrink-0" />
                                </div>
                            </div>
                        </div>
                </div>
            </div>

            {/* Deep Session Modal (Available on Mobile & Desktop) */}
            {sessionModalOpen && (
                <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={handleClose} />
                    <div className={`relative w-full max-w-2xl premium-panel shadow-2xl flex flex-col overflow-hidden h-[85vh] sm:h-[75vh] ${isClosing ? 'animate-macos-shrink-left' : 'animate-macos-expand-left'}`}>
                        {/* Header */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                                    <Icon name="history" className="text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-wider">{t('sidebar.tooltips.sessions')}</h2>
                                    <p className="text-xs text-slate-500">Manage, load and branch conversation states</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { (state as any).onImportSession(); handleClose(); }}
                                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                    title={t('sidebar.tooltips.import_session')}
                                >
                                    <Icon name="download" /> {t('common.import')}
                                </button>
                                <button
                                    onClick={() => { (state as any).onNewSession(); handleClose(); }}
                                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                    title={t('sidebar.tooltips.new_session')}
                                >
                                    <Icon name="plus" /> {t('common.new')}
                                </button>
                                <div className="w-px h-6 bg-slate-800 mx-1" />
                                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title={t('sidebar.tooltips.close_manager')}>
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
