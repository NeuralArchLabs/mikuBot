import React, { useState, useEffect } from 'react';
import { AppConfig, Provider, ModelInfo } from '../../types';
import { Icon } from '../common/Common';

interface SkillsPanelProps {
    config: AppConfig;
    updateConfig: (updates: Partial<AppConfig>) => void;
    onSaveGlobal: () => void;
}

interface Skill {
    name: string;
    description: string;
    parameters: any;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({ config, updateConfig, onSaveGlobal }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSkill, setActiveSkill] = useState<string | null>(null);

    useEffect(() => {
        const loadSkills = async () => {
            if ((window as any).electron?.invoke && config.folderPaths?.tools) {
                try {
                    const res = await (window as any).electron.invoke('list-skills', { toolsPath: config.folderPaths.tools });
                    if (res.ok && Array.isArray(res.skills)) {
                        setSkills(res.skills);
                        if (res.skills.length > 0) setActiveSkill(res.skills[0].name);
                    }
                } catch (err) {
                    console.error("Failed to load skills:", err);
                }
            }
            setLoading(false);
        };
        loadSkills();
    }, [config.folderPaths?.tools]);

    const handleUpdateSkillConfig = (skillName: string, key: string, value: any) => {
        const currentSkillsConfig = config.skillsConfig || {};
        const skillConfig = currentSkillsConfig[skillName] || {};

        updateConfig({
            skillsConfig: {
                ...currentSkillsConfig,
                [skillName]: {
                    ...skillConfig,
                    [key]: value
                }
            }
        });
    };

    const currentSkill = skills.find(s => s.name === activeSkill);
    const skillConfig = (config.skillsConfig || {})[activeSkill || ''] || {};

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40 backdrop-blur-md">
            {/* Header */}
            <div className="p-8 border-b border-slate-800/50 bg-slate-900/20">
                <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
                    <div>
                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                            <span className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                                <Icon name="puzzle-piece" />
                            </span>
                            Neural Skills Center
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm font-medium tracking-wide">
                            Configure advanced capabilities and secure credentials for your local agents.
                        </p>
                    </div>
                    <button
                        onClick={onSaveGlobal}
                        className="btn-halo px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
                    >
                        <Icon name="save" />
                        Save Sync
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden max-w-5xl mx-auto w-full p-6 gap-6">
                {/* Skills Sidebar */}
                <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Available Skills</h3>
                    {loading ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 bg-slate-800/30 animate-pulse rounded-xl" />
                            ))}
                        </div>
                    ) : skills.length === 0 ? (
                        <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 text-center">
                            <Icon name="folder-open" className="text-slate-600 text-xl mb-2" />
                            <p className="text-xs text-slate-500">No skills found in tools path.</p>
                        </div>
                    ) : (
                        skills.map(skill => (
                            <button
                                key={skill.name}
                                onClick={() => setActiveSkill(skill.name)}
                                className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all text-left border ${activeSkill === skill.name
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100 shadow-inner shadow-cyan-900/20'
                                        : 'bg-slate-900/40 border-slate-800/50 text-slate-400 hover:bg-slate-800/40 hover:border-slate-700'
                                    }`}
                            >
                                <Icon name={skill.name.includes('gmail') ? 'envelope' : skill.name.includes('search') ? 'globe' : 'terminal'}
                                    className={activeSkill === skill.name ? 'text-cyan-400' : 'text-slate-500'} />
                                <span className="font-bold text-sm truncate">{skill.name}</span>
                            </button>
                        ))
                    )}
                </div>

                {/* Configuration Area */}
                <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800/50 p-8 overflow-y-auto custom-scrollbar relative">
                    {currentSkill ? (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center text-3xl text-cyan-400 border border-slate-700/50">
                                    <Icon name={currentSkill.name.includes('gmail') ? 'envelope' : 'puzzle-piece'} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">{currentSkill.name}</h3>
                                    <p className="text-slate-400 text-sm mt-1">{currentSkill.description}</p>
                                </div>
                            </div>

                            <div className="h-px bg-slate-800/50 mb-8" />

                            <div className="space-y-8">
                                {currentSkill.name === 'gmail_imap' && (
                                    <>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                                <Icon name="at" className="text-cyan-500" />
                                                Email Identity
                                            </label>
                                            <input
                                                type="email"
                                                value={skillConfig.email || ''}
                                                onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'email', e.target.value)}
                                                placeholder="miku@gmail.com"
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all font-mono"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                                <Icon name="key" className="text-amber-500" />
                                                App Password (16 characters)
                                            </label>
                                            <input
                                                type="password"
                                                value={skillConfig.app_password || ''}
                                                onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'app_password', e.target.value)}
                                                placeholder="xxxx xxxx xxxx xxxx"
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-mono tracking-widest"
                                            />
                                            <p className="text-[11px] text-slate-500 italic">
                                                Generate this in your Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords.
                                            </p>
                                        </div>
                                    </>
                                )}

                                {currentSkill.name !== 'gmail_imap' && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                                        <Icon name="sliders-h" className="text-4xl text-slate-600 mb-4" />
                                        <p className="text-slate-400 font-medium">This skill has no global configuration parameters.</p>
                                        <p className="text-xs text-slate-600 mt-2">Miku will handle parameters dynamically during execution.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                            <div className="w-24 h-24 rounded-full bg-slate-800/30 flex items-center justify-center text-5xl mb-6">
                                <Icon name="puzzle-piece" className="animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300 uppercase tracking-tighter">Neural Interface Ready</h3>
                            <p className="text-sm text-slate-500 mt-2 max-w-xs">Select a skill from the sidebar to manage its synaptic configuration.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
