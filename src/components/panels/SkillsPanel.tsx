import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../../types';
import { Icon } from '../common/Common';

interface SkillsPanelProps {
    config: AppConfig;
    toolsFiles: Record<string, string>;
    onSaveTools: (name: string, content: string) => Promise<boolean>;
    updateConfig: (updates: Partial<AppConfig>) => void;
    onSaveGlobal: () => void;
    showBlueprints: boolean;
    setShowBlueprints: (show: boolean) => void;
}

interface Skill {
    name: string;
    description: string;
    parameters: any;
    entry: string;
    __folderName: string;
}

interface SkillBlueprint {
    id: string;
    icon: string;
    category: string;
    name_es?: string;
    name_en?: string;
    name_zh?: string;
    manifest: {
        name: string;
        name_es?: string;
        name_en?: string;
        name_zh?: string;
        description: string;
        description_es?: string;
        description_en?: string;
        description_zh?: string;
        parameters: any;
        runtime: "python" | "node";
        entry: string;
    };
    entryContent: string;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({ config, toolsFiles, onSaveTools, updateConfig, onSaveGlobal, showBlueprints, setShowBlueprints }) => {
    const { i18n, t } = useTranslation();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSkill, setActiveSkill] = useState<string | null>(null);
    const [editMode, setEditMode] = useState<'config' | 'code'>('config');
    const [activeFile, setActiveFile] = useState<string>('manifest.json');
    const [editorContent, setEditorContent] = useState<string>('');
    const [isSavingCode, setIsSavingCode] = useState(false);
    const [rawBlueprints, setRawBlueprints] = useState<SkillBlueprint[]>([]);
    const [blueprints, setBlueprints] = useState<SkillBlueprint[]>([]);
    const [namingSkill, setNamingSkill] = useState<SkillBlueprint | null>(null);
    const [newSkillName, setNewSkillName] = useState('');

    useEffect(() => {
        const loadBlueprints = async () => {
            const isElectron = typeof window !== 'undefined' && (window as any).electron?.listBlueprints;
            if (isElectron && config.folderPaths?.tools) {
                const response = await (window as any).electron.listBlueprints({
                    toolsPath: config.folderPaths.tools,
                    corePath: config.folderPaths.core
                });
                if (response.ok) {
                    setRawBlueprints(response.blueprints.filter((b: any) => b.category === 'skills'));
                }
            }
        };
        if (showBlueprints) loadBlueprints();
    }, [showBlueprints, config.folderPaths?.tools]);

    // Helper function to get localized name from skill blueprint
    const getSkillName = useCallback((bp: SkillBlueprint): string => {
        const lang = (i18n.language || 'en').split('-')[0];
        // Use bracket notation for dynamic keys
        const value = bp[`name_${lang}` as any] ||
            bp.name_en ||
            bp.name_es ||
            '';
        return String(value);
    }, [i18n.language]);

    // Helper function to get localized description from skill blueprint
    const getSkillDescription = useCallback((bp: SkillBlueprint): string => {
        const lang = (i18n.language || 'en').split('-')[0];
        const manifest = bp.manifest || {} as any;
        // Use bracket notation for dynamic keys
        const value = manifest[`description_${lang}` as any] ||
            manifest.description_en ||
            manifest.description_es ||
            manifest.description ||
            '';
        return String(value);
    }, [i18n.language]);

    // Normalize blueprints when language changes
    useEffect(() => {
        const normalized = rawBlueprints.map(bp => ({
            ...bp,
            name: getSkillName(bp),
            description: getSkillDescription(bp)
        }));
        setBlueprints(normalized);
    }, [rawBlueprints, i18n.language, getSkillName, getSkillDescription]);

    const loadSkills = useCallback(async () => {
        if ((window as any).electron?.listSkills && config.folderPaths?.tools) {
            try {
                const res = await (window as any).electron.listSkills({ toolsPath: config.folderPaths.tools });
                if (res.ok && Array.isArray(res.skills)) {
                    setSkills(res.skills);
                } else {
                    console.warn("[Skills] No skills detected or error listing.");
                    setSkills([]);
                }
            } catch (error) {
                console.error("Error loading skills:", error);
                alert(t('skills.error_loading'));
            } finally {
                setLoading(false);
            }
        }
    }, [config.folderPaths?.tools, t]);

    useEffect(() => {
        loadSkills();
    }, [loadSkills, toolsFiles]);

    const currentSkill = skills.find(s => s.name === activeSkill);
    const skillConfig = (config.skillsConfig || {})[activeSkill || ''] || {};

    useEffect(() => {
        if (currentSkill && editMode === 'code') {
            const filePath = `skills/${currentSkill.__folderName}/${activeFile}`;
            setEditorContent(toolsFiles[filePath] || '');
        }
    }, [currentSkill, activeFile, editMode, toolsFiles]);

    const handleUpdateSkillConfig = (skillName: string, key: string, value: any) => {
        const currentSkillsConfig = config.skillsConfig || {};
        const skillConfig = currentSkillsConfig[skillName] || {};
        updateConfig({
            skillsConfig: {
                ...currentSkillsConfig,
                [skillName]: { ...skillConfig, [key]: value }
            }
        });
    };

    const handleSaveCode = async () => {
        if (!currentSkill) return;
        setIsSavingCode(true);
        const filePath = `skills/${currentSkill.__folderName}/${activeFile}`;
        const success = await onSaveTools(filePath, editorContent);
        if (success) {
            console.log("Code saved successfully");
        }
        setIsSavingCode(false);
    };

    const handleCreateFromBlueprint = async () => {
        if (!namingSkill || !newSkillName.trim()) return;
        
        try {
            const folderName = newSkillName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const manifest = { ...namingSkill.manifest, name: folderName };

            const folderPath = `skills/${folderName}`;
            const okManifest = await onSaveTools(`${folderPath}/manifest.json`, JSON.stringify(manifest, null, 4));
            const okEntry = await onSaveTools(`${folderPath}/${manifest.entry}`, namingSkill.entryContent);

            if (okManifest && okEntry) {
                setNamingSkill(null);
                setShowBlueprints(false);
                await loadSkills();
                setActiveSkill(folderName);
                setEditMode('code');
            } else {
                console.error("Failed to save skill files:", { okManifest, okEntry });
                alert(t('skills.error_saving'));
            }
        } catch (error) {
            console.error("Error creating skill from blueprint:", error);
            alert(t('skills.error_creating'));
        }
    };

    const handleDeleteSkill = async (folderName: string) => {
        const confirmMsg = t('skills.delete_confirm', { name: folderName });
            
        if (confirm(confirmMsg)) {
            if ((window as any).electron?.deleteSkill && config.folderPaths?.tools) {
                const res = await (window as any).electron.deleteSkill({ 
                    toolsPath: config.folderPaths.tools, 
                    folderName 
                });
                if (res.ok) {
                    await loadSkills();
                    if (activeSkill === folderName) setActiveSkill(null);
                } else {
                    alert(t('common.operation_failed') + ": " + res.error);
                }
            }
        }
    };

    const renderEditorContent = () => {
        if (!currentSkill) return null;

        return (
            <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-700">
                <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-950/20 px-2 lg:px-6 shrink-0 relative">
                    <div className="flex">
                        <button
                            onClick={() => setEditMode('config')}
                            className={`px-4 lg:px-6 py-4 text-[11px] lg:text-xs font-bold uppercase tracking-[0.15em] transition-all relative z-10 ${editMode === 'config' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {t('skills.properties')}
                            {editMode === 'config' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4] animate-in fade-in duration-500" />}
                        </button>
                        <button
                            onClick={() => setEditMode('code')}
                            className={`px-4 lg:px-6 py-4 text-[11px] lg:text-xs font-bold uppercase tracking-[0.15em] transition-all relative z-10 ${editMode === 'code' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {t('skills.neural_logic')}
                            {editMode === 'code' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4] animate-in fade-in duration-500" />}
                        </button>
                    </div>

                    <button
                        onClick={() => handleDeleteSkill(currentSkill.__folderName)}
                        className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-transparent text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-all flex items-center justify-center group/del"
                        title={t('skills.delete_btn')}
                    >
                        <Icon name="trash-alt" className="text-xs lg:text-[13px] group-hover/del:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
                    {editMode === 'config' && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="hidden lg:flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-3xl text-cyan-400 border border-slate-700/50 shadow-2xl shrink-0">
                                    <Icon name={currentSkill.name.includes('gmail') ? 'envelope' : 'puzzle-piece'} />
                                </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="robot" className="text-cyan-400/80 mr-1" />
                                        <h3 className="text-lg font-semibold text-white uppercase tracking-wide truncate leading-none">{currentSkill.name}</h3>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-2 line-clamp-2 font-normal">{currentSkill.description}</p>
                            </div>

                            <div className="hidden lg:block h-px bg-gradient-to-r from-slate-800/50 via-slate-700 to-slate-800/50 mb-8" />

                            <div className="space-y-6 lg:space-y-8">
                                {currentSkill.name === 'gmail_imap' ? (
                                    <>
                                        <div className="space-y-3">
                                            <label htmlFor="email-identity" className="text-xs lg:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Icon name="at" className="text-cyan-500" />
                                                {t('skills.email_identity')}
                                            </label>
                                                <input
                                                    id="email-identity"
                                                    type="email"
                                                    placeholder="your@email.com"
                                                    value={skillConfig.email || ''}
                                                    onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'email', e.target.value)}
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none transition-all placeholder:text-slate-700"
                                                />
                                        </div>
                                        <div className="space-y-3">
                                            <label htmlFor="app-password" className="text-xs lg:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Icon name="key" className="text-amber-500" />
                                                {t('skills.app_password')}
                                            </label>
                                                <input
                                                    id="app-password"
                                                    type="password"
                                                    placeholder="••••••••••••"
                                                    value={skillConfig.app_password || ''}
                                                    onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'app_password', e.target.value)}
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none transition-all placeholder:text-slate-700"
                                                />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-60">
                                        <Icon name="sliders-h" className="text-4xl text-slate-800 mb-4" />
                                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t('skills.automatic_title')}</h5>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 max-w-[180px] text-center leading-relaxed">
                                            {t('skills.automatic_desc')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {editMode === 'code' && (
                        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 min-h-[350px] lg:min-h-0">
                            <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <div className="flex items-center gap-2 font-mono">
                                    <button
                                        onClick={() => setActiveFile('manifest.json')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs border transition-all duration-300 ${activeFile === 'manifest.json' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/10' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                            } hover:border-cyan-500/40`}
                                    >
                                        manifest.json
                                    </button>
                                    <button
                                        onClick={() => setActiveFile(currentSkill.entry)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs border transition-all duration-300 ${activeFile === currentSkill.entry ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/10' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                            } hover:border-cyan-500/40`}
                                    >
                                        {currentSkill.entry}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSaveCode}
                                    disabled={isSavingCode}
                                    className="px-4 py-2 bg-cyan-600/20 border border-transparent hover:border-cyan-500/40 text-cyan-400 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all flex items-center gap-2 group"
                                >
                                    {isSavingCode ? <Icon name="circle-notch" className="animate-spin" /> : <Icon name="cloud-upload-alt" className="group-hover:translate-y-[-2px] transition-transform" />}
                                    Commit
                                </button>
                            </div>
                            <textarea
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                placeholder="// Awaiting instructions..."
                                className="flex-1 premium-input rounded-xl lg:rounded-2xl p-5 font-mono text-[11px] lg:text-sm text-slate-300 focus:outline-none resize-none custom-scrollbar shadow-2xl"
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden w-full lg:flex lg:flex-row p-3 lg:p-1.5 xl:p-8 gap-2 xl:gap-6 relative custom-scrollbar">
                {/* Blueprints Overlay */}
                {showBlueprints && (
                    <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 p-8 lg:p-10 rounded-3xl max-w-3xl w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-fade-scale overflow-y-auto max-h-[90vh]">
                            {!namingSkill ? (
                                <>
                                    <div className="flex items-center justify-between mb-8 lg:mb-10">
                                        <div>
                                            <h3 className="text-xl lg:text-2xl font-bold text-white uppercase tracking-tight">{t('skills.blueprints_title')}</h3>
                                            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">{t('skills.blueprints_desc')}</p>
                                        </div>
                                        <button
                                            onClick={() => setShowBlueprints(false)}
                                            className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-full transition-all"
                                            title="Close blueprints overlay"
                                        >
                                            <Icon name="times" className="text-xl" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2">
                                        {blueprints.map(bp => (
                                            <button
                                                key={bp.id}
                                                onClick={() => {
                                                    setNamingSkill(bp);
                                                    setNewSkillName(bp.manifest.name);
                                                }}
                                                className="p-6 lg:p-8 bg-slate-800/20 hover:bg-slate-800/40 border border-slate-700/30 hover:border-cyan-500/50 rounded-3xl text-left transition-all group relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Icon name={bp.icon} className="text-6xl" />
                                                </div>
                                                <div className="text-3xl lg:text-4xl text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                                                    <Icon name={bp.icon} />
                                                </div>
                                                <div className="font-semibold text-slate-100 text-base lg:text-lg uppercase tracking-tight">{getSkillName(bp)}</div>
                                                <div className="text-[11px] lg:text-xs text-slate-500 mt-2 leading-relaxed font-medium">{getSkillDescription(bp)}</div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                    <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-center py-6 text-center">
                                    <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 flex items-center justify-center text-4xl text-cyan-400 mb-8 shadow-glow-cyan border border-cyan-500/20">
                                        <Icon name={namingSkill.icon} />
                                    </div>
                                    <h4 className="text-xl lg:text-2xl font-bold text-white uppercase tracking-tight mb-2">{t('skills.configure_title')}</h4>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-10">{t('skills.configure_desc')}</p>

                                    <input
                                        autoFocus
                                        value={newSkillName}
                                        onChange={(e) => setNewSkillName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFromBlueprint()}
                                        className="w-full max-w-sm premium-input rounded-2xl px-6 py-5 text-sm lg:text-base text-white mb-10 text-center font-mono focus:ring-2 ring-cyan-500/30"
                                        placeholder={t('skills.placeholder_id')}
                                    />

                                    <div className="flex gap-4 w-full max-w-sm">
                                        <button
                                            onClick={() => setNamingSkill(null)}
                                            className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700/50"
                                        >
                                            {t('common.back')}
                                        </button>
                                        <button
                                            onClick={handleCreateFromBlueprint}
                                            className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-glow-cyan shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]"
                                        >
                                            {t('skills.btn_deploy')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vertical Skills List */}
                <div className="w-full lg:w-52 xl:w-72 shrink-0 flex flex-col gap-3 lg:gap-2 xl:gap-4 lg:pr-2 xl:pr-4 lg:overflow-y-auto custom-scrollbar">
                    <h3 className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.3em] px-4 mb-2">{t('skills.repository')}</h3>
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="w-full h-20 bg-slate-900/50 animate-pulse rounded-2xl border border-slate-800/30" />)}
                        </div>
                    ) : (
                        skills.map(skill => {
                            const isDisabled = (config.disabledSkills || []).includes(skill.name);
                            return (
                                <div key={skill.name} className="flex flex-col gap-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveSkill(skill.name === activeSkill && window.innerWidth < 1024 ? null : skill.name)}
                                            className={`w-full p-4 lg:p-2.5 xl:p-4 rounded-2xl flex items-center text-left border group relative overflow-hidden premium-card premium-cyan transition-all duration-500 ${activeSkill === skill.name ? 'active border-cyan-500/40 shadow-glow-cyan ring-1 ring-cyan-400/20' : 'text-slate-400 opacity-70'} ${isDisabled ? 'opacity-30' : ''}`}
                                            title={`Select ${skill.name} skill`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 relative z-10 w-full">
                                                <div className={`p-2.5 rounded-xl text-base shrink-0 transition-all duration-500 ${activeSkill === skill.name ? 'bg-cyan-500 text-black scale-110 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                                                    <Icon name={skill.name.includes('gmail') ? 'envelope' : skill.name.includes('search') ? 'globe' : 'terminal'} />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1 pr-10">
                                                    <span className={`font-semibold text-xs uppercase tracking-tight truncate transition-colors duration-500 ${activeSkill === skill.name ? 'text-white' : 'text-slate-400'}`}>{skill.name}</span>
                                                    <span className="text-[9px] text-slate-600 font-medium uppercase tracking-widest mt-0.5 truncate">{skill.__folderName}</span>
                                                </div>
                                            </div>
                                            {/* Subtle background glow for active */}
                                            {activeSkill === skill.name && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />}
                                        </button>

                                        {/* Toggle Container */}
                                        <div className="absolute top-1/2 -translate-y-1/2 right-3 z-20 flex items-center">
                                            {/* Enable/Disable Toggle */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const current = config.disabledSkills || [];
                                                    const updated = isDisabled
                                                        ? current.filter(n => n !== skill.name)
                                                        : [...current, skill.name];
                                                    updateConfig({ disabledSkills: updated });
                                                }}
                                                title={isDisabled ? `Enable ${skill.name}` : `Disable ${skill.name}`}
                                            >
                                            <div className={`w-9 h-5 rounded-full transition-all duration-300 relative ${isDisabled ? 'bg-slate-700' : 'bg-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${isDisabled ? 'left-0.5 bg-slate-500' : 'left-[18px] bg-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.5)]'}`} />
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                    {/* Inline Editor with Premium Animation */}
                                    {activeSkill === skill.name && (
                                        <div className="lg:hidden bg-slate-900/40 border border-slate-800/50 rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 shadow-2xl mb-4">
                                            {renderEditorContent()}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Standalone Editor for Desktop View */}
                <div className="hidden lg:flex flex-1 premium-panel flex-col overflow-hidden min-w-0 shadow-2xl">
                    {currentSkill ? (
                        renderEditorContent()
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-40 p-10 sm:p-16 text-center">
                            <div className="relative mb-6 sm:mb-8">
                                <div className="absolute inset-0 bg-cyan-500/10 blur-[80px] rounded-full animate-pulse" />
                                <Icon name="puzzle-piece" className="relative text-5xl sm:text-7xl text-slate-700 animate-pulse" />
                            </div>
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('skills.standby_title')}</h3>
                            <p className="text-[10px] sm:text-xs max-w-[240px] sm:max-w-xs leading-relaxed font-bold uppercase tracking-widest">{t('skills.standby_desc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
