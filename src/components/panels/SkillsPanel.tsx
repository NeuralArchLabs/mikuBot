import React, { useState, useEffect } from 'react';
import { AppConfig } from '../../types';
import { Icon } from '../common/Common';

interface SkillsPanelProps {
    config: AppConfig;
    toolsFiles: Record<string, string>;
    onSaveTools: (name: string, content: string) => Promise<boolean>;
    updateConfig: (updates: Partial<AppConfig>) => void;
    onSaveGlobal: () => void;
}

interface Skill {
    name: string;
    description: string;
    parameters: any;
    entry: string;
    __folderName: string;
}

const BLUEPRINTS = [
    {
        id: 'python_basic',
        name: 'Python Logic',
        icon: 'python',
        manifest: {
            name: "new_python_skill",
            description: "A logic skill using Python.",
            parameters: { type: "object", properties: { query: { type: "string" } } },
            runtime: "python",
            entry: "main.py"
        },
        entryContent: `import sys\nimport json\n\ndef main():\n    args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}\n    print(json.dumps({"success": True, "message": "Python skill executed!", "echo": args}))\n\nif __name__ == "__main__":\n    main()`
    },
    {
        id: 'node_basic',
        name: 'Node.js Logic',
        icon: 'node-js',
        manifest: {
            name: "new_node_skill",
            description: "A logic skill using Node.js.",
            parameters: { type: "object", properties: { query: { type: "string" } } },
            runtime: "node",
            entry: "index.js"
        },
        entryContent: `const args = JSON.parse(process.argv[2] || '{}');\nconsole.log(JSON.stringify({ success: true, message: 'Node.js skill executed!', echo: args }));`
    }
];

export const SkillsPanel: React.FC<SkillsPanelProps> = ({ config, toolsFiles, onSaveTools, updateConfig, onSaveGlobal }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSkill, setActiveSkill] = useState<string | null>(null);
    const [editMode, setEditMode] = useState<'config' | 'code'>('config');
    const [activeFile, setActiveFile] = useState<string>('manifest.json');
    const [editorContent, setEditorContent] = useState<string>('');
    const [showBlueprints, setShowBlueprints] = useState(false);
    const [isSavingCode, setIsSavingCode] = useState(false);

    useEffect(() => {
        const loadSkills = async () => {
            if ((window as any).electron?.listSkills && config.folderPaths?.tools) {
                try {
                    const res = await (window as any).electron.listSkills({ toolsPath: config.folderPaths.tools });
                    if (res.ok && Array.isArray(res.skills)) {
                        setSkills(res.skills);
                    }
                } catch (err) {
                    console.error("Failed to load skills:", err);
                }
            }
            setLoading(false);
        };
        loadSkills();
    }, [config.folderPaths?.tools, toolsFiles]);

    const currentSkill = skills.find(s => s.name === activeSkill);
    const skillConfig = (config.skillsConfig || {})[activeSkill || ''] || {};

    // Update editor content when active file or skill changes
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

    const handleCreateFromBlueprint = async (blueprint: typeof BLUEPRINTS[0]) => {
        const name = prompt("Skill folder name:", blueprint.manifest.name);
        if (!name) return;

        const folderPath = `skills/${name}`;
        const manifest = { ...blueprint.manifest, name: name };

        await onSaveTools(`${folderPath}/manifest.json`, JSON.stringify(manifest, null, 4));
        await onSaveTools(`${folderPath}/${manifest.entry}`, blueprint.entryContent);

        setShowBlueprints(false);
        setActiveSkill(name);
        setEditMode('code');
    };

    // Shared editor component to avoid repetition
    const renderEditorContent = () => {
        if (!currentSkill) return null;

        return (
            <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-700">
                {/* Tab Selector */}
                <div className="flex border-b border-slate-800/50 bg-slate-950/20 px-2 lg:px-6 shrink-0 relative">
                    <button
                        onClick={() => setEditMode('config')}
                        className={`px-4 lg:px-6 py-4 text-[11px] lg:text-xs font-bold uppercase tracking-[0.15em] transition-all relative z-10 ${editMode === 'config' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Properties
                        {editMode === 'config' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />}
                    </button>
                    <button
                        onClick={() => setEditMode('code')}
                        className={`px-4 lg:px-6 py-4 text-[11px] lg:text-xs font-bold uppercase tracking-[0.15em] transition-all relative z-10 ${editMode === 'code' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Neural Logic
                        {editMode === 'code' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
                    {editMode === 'config' && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="hidden lg:flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-3xl text-cyan-400 border border-slate-700/50 shadow-2xl shrink-0">
                                    <Icon name={currentSkill.name.includes('gmail') ? 'envelope' : 'puzzle-piece'} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-white uppercase tracking-wide truncate leading-none">{currentSkill.name}</h3>
                                    <p className="text-slate-500 text-xs mt-2 line-clamp-2 font-normal">{currentSkill.description}</p>
                                </div>
                            </div>

                            <div className="hidden lg:block h-px bg-gradient-to-r from-slate-800/50 via-slate-700 to-slate-800/50 mb-8" />

                            <div className="space-y-6 lg:space-y-8">
                                {currentSkill.name === 'gmail_imap' ? (
                                    <>
                                        <div className="space-y-3">
                                            <label htmlFor="email-identity" className="text-xs lg:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Icon name="at" className="text-cyan-500" />
                                                Email Identity
                                            </label>
                                            <input
                                                id="email-identity"
                                                type="email"
                                                placeholder="your@email.com"
                                                value={skillConfig.email || ''}
                                                onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'email', e.target.value)}
                                                className="w-full bg-slate-950/40 border border-slate-800/60 rounded-xl px-4 py-3 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all placeholder:text-slate-700"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label htmlFor="app-password" className="text-xs lg:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Icon name="key" className="text-amber-500" />
                                                App Password
                                            </label>
                                            <input
                                                id="app-password"
                                                type="password"
                                                placeholder="••••••••••••"
                                                value={skillConfig.app_password || ''}
                                                onChange={(e) => handleUpdateSkillConfig('gmail_imap', 'app_password', e.target.value)}
                                                className="w-full bg-slate-950/40 border border-slate-800/60 rounded-xl px-4 py-3 text-sm text-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-slate-700"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 lg:py-16 text-center">
                                        <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                                            <Icon name="sliders-h" className="relative text-4xl lg:text-5xl text-slate-700" />
                                        </div>
                                        <p className="text-slate-400 font-semibold uppercase tracking-[0.15em] text-xs lg:text-xs">Automatic Execution System</p>
                                        <p className="text-[10px] lg:text-xs text-slate-600 mt-3 max-w-[200px] leading-relaxed font-normal">Neural parameters are managed dynamically by the core engine.</p>
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
                                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs border transition-all ${activeFile === 'manifest.json' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        manifest.json
                                    </button>
                                    <button
                                        onClick={() => setActiveFile(currentSkill.entry)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs border transition-all ${activeFile === currentSkill.entry ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        {currentSkill.entry}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSaveCode}
                                    disabled={isSavingCode}
                                    className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all flex items-center gap-2 group"
                                >
                                    {isSavingCode ? <Icon name="circle-notch" className="animate-spin" /> : <Icon name="cloud-upload-alt" className="group-hover:translate-y-[-2px] transition-transform" />}
                                    Commit
                                </button>
                            </div>
                            <textarea
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                placeholder="// Awaiting instructions..."
                                className="flex-1 bg-slate-950/80 rounded-xl lg:rounded-2xl p-5 font-mono text-[11px] lg:text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 border border-slate-800/50 resize-none custom-scrollbar shadow-2xl"
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
            {/* Header */}
            <div className="py-5 lg:py-8 border-b border-slate-800/50 bg-slate-900/40 shrink-0 px-4 lg:px-8 transform-gpu" style={{ contain: 'paint' }}>
                <div className="flex flex-wrap items-center gap-4 w-full">
                    <div className="flex items-center gap-3 min-w-0 mr-auto group">
                        <div className="text-cyan-400 text-xl lg:text-3xl shrink-0 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-title-slide">
                            <Icon name="puzzle-piece" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl lg:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 text-shadow-premium select-none animate-title-slide">
                                Neural Skills
                            </h2>
                            <p className="text-cyan-500/60 text-[10px] lg:text-xs font-bold tracking-widest uppercase select-none mt-0.5 animate-title-slide hidden lg:block">Synaptic Core Architecture</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowBlueprints(!showBlueprints)}
                            className="px-4 lg:px-6 py-2.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-700/50 text-xs lg:text-sm hover:scale-105 active:scale-95"
                        >
                            <Icon name="plus" />
                            <span className="hidden lg:inline">New Directive</span>
                        </button>
                        <button
                            onClick={onSaveGlobal}
                            className="btn-halo px-4 lg:px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] text-xs lg:text-sm hover:scale-105 active:scale-95 group/sync"
                        >
                            <Icon name="sync" className="group-hover/sync:rotate-180 transition-transform duration-500" />
                            <span className="hidden lg:inline">Save Sync</span>
                            <span className="lg:hidden">Sync</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden w-full lg:flex lg:flex-row p-4 lg:p-8 gap-8 relative custom-scrollbar">
                {/* Blueprints Overlay */}
                {showBlueprints && (
                    <div className="fixed lg:absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-12">
                        <div className="bg-slate-900 border border-slate-800 p-8 lg:p-10 rounded-3xl max-w-3xl w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-fade-scale overflow-y-auto max-h-[90vh]">
                            <div className="flex items-center justify-between mb-8 lg:mb-10">
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-bold text-white uppercase tracking-tight">Neural Blueprints</h3>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Select a foundation for deployment</p>
                                </div>
                                <button
                                    onClick={() => setShowBlueprints(false)}
                                    className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-full transition-all"
                                    title="Close blueprints overlay"
                                >
                                    <Icon name="times" className="text-xl" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {BLUEPRINTS.map(bp => (
                                    <button
                                        key={bp.id}
                                        onClick={() => handleCreateFromBlueprint(bp)}
                                        className="p-6 lg:p-8 bg-slate-800/20 hover:bg-slate-800/40 border border-slate-700/30 hover:border-cyan-500/50 rounded-3xl text-left transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Icon name={bp.icon} className="text-6xl" />
                                        </div>
                                        <div className="text-3xl lg:text-4xl text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                                            <Icon name={bp.icon} />
                                        </div>
                                        <div className="font-semibold text-slate-100 text-base lg:text-lg uppercase tracking-tight">{bp.name}</div>
                                        <div className="text-[11px] lg:text-xs text-slate-500 mt-2 leading-relaxed font-medium">{bp.manifest.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vertical Skills List */}
                <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:pr-4 lg:overflow-y-auto custom-scrollbar">
                    <h3 className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.3em] px-4 mb-2">Synaptic Repository</h3>
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
                                            className={`w-full p-4 rounded-2xl flex items-center transition-all duration-500 text-left border group relative overflow-hidden ${activeSkill === skill.name
                                                ? 'bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.1)] ring-1 ring-cyan-400/20'
                                                : 'bg-slate-900/30 border-slate-800/40 text-slate-400 hover:bg-slate-800/30 hover:border-slate-700'
                                                } ${isDisabled ? 'opacity-50' : ''}`}
                                            title={`Select ${skill.name} skill`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 relative z-10 w-full">
                                                <div className={`p-2.5 rounded-xl text-base shrink-0 transition-all duration-500 ${activeSkill === skill.name ? 'bg-cyan-500 text-black scale-110 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                                                    <Icon name={skill.name.includes('gmail') ? 'envelope' : skill.name.includes('search') ? 'globe' : 'terminal'} />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className={`font-semibold text-xs uppercase tracking-wide transition-colors duration-500 ${activeSkill === skill.name ? 'text-white' : 'text-slate-400'}`}>{skill.name}</span>
                                                    <span className="text-[9px] text-slate-600 font-medium uppercase tracking-widest mt-0.5 truncate">{skill.__folderName}</span>
                                                </div>
                                            </div>
                                            {/* Subtle background glow for active */}
                                            {activeSkill === skill.name && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />}
                                        </button>

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
                                            className="absolute top-1/2 -translate-y-1/2 right-3 z-20"
                                            title={isDisabled ? `Enable ${skill.name}` : `Disable ${skill.name}`}
                                        >
                                            <div className={`w-9 h-5 rounded-full transition-all duration-300 relative ${isDisabled ? 'bg-slate-700' : 'bg-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${isDisabled ? 'left-0.5 bg-slate-500' : 'left-[18px] bg-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.5)]'}`} />
                                            </div>
                                        </button>
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
                <div className="hidden lg:flex flex-1 bg-slate-900/40 rounded-[2.5rem] border border-slate-800/50 flex-col overflow-hidden min-w-0 shadow-2xl">
                    {currentSkill ? (
                        renderEditorContent()
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-40 p-10 sm:p-16 text-center">
                            <div className="relative mb-6 sm:mb-8">
                                <div className="absolute inset-0 bg-cyan-500/10 blur-[80px] rounded-full animate-pulse" />
                                <Icon name="puzzle-piece" className="relative text-5xl sm:text-7xl text-slate-700 animate-pulse" />
                            </div>
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Neural Standby</h3>
                            <p className="text-[10px] sm:text-xs max-w-[240px] sm:max-w-xs leading-relaxed font-bold uppercase tracking-widest">Awaiting selection to initialize neural Pathways</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
