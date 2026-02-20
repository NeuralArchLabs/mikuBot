import React, { useState, useEffect } from 'react';
import { AppConfig } from '../../types';
import { Icon } from '../common/Common';
import { DEFAULT_CONFIG } from '../../constants';

interface OnboardingProps {
    onComplete: (config: AppConfig, handles: any) => Promise<void>;
}

export const OnboardingWizard: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [pathMode, setPathMode] = useState<'default' | 'custom'>('default');
    const [defaultPath, setDefaultPath] = useState('');
    const [customPath, setCustomPath] = useState('');
    const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDefault = async () => {
            if ((window as any).electron) {
                const res = await (window as any).electron.getDefaultPath();
                if (res.ok) {
                    setDefaultPath(res.path);
                    setCustomPath(res.path);
                }
            } else {
                setDefaultPath('/mikuCentral');
            }
        };
        fetchDefault();
    }, []);

    const selectedPath = pathMode === 'default' ? defaultPath : customPath;

    const handleNext = async () => {
        if (step === 2) {
            setLoading(true);
            setError('');
            try {
                if ((window as any).electron) {
                    const setupRes = await (window as any).electron.setupOnboarding({ targetPath: selectedPath });
                    if (!setupRes.ok) {
                        throw new Error("Failed to initialize folders: " + setupRes.error);
                    }
                }
                setStep(3);
            } catch (err: any) {
                setError(err.message || 'Unknown error');
            } finally {
                setLoading(false);
            }
        } else {
            setStep(prev => prev + 1);
        }
    };

    const handlePrev = () => setStep(prev => prev - 1);

    const finishWithLinkages = async () => {
        setLoading(true);
        setError('');
        try {
            const mainHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });

            // Validate that the user selected the actual folder by checking its name or content
            // We just extract the handles we need
            const coreH = await mainHandle.getDirectoryHandle('core', { create: true });
            const commandsH = await mainHandle.getDirectoryHandle('commands', { create: true });
            const workspaceH = await mainHandle.getDirectoryHandle('workspace', { create: true });
            const libraryH = await mainHandle.getDirectoryHandle('library', { create: true });

            const nextConfig = {
                ...config,
                isConfigured: true
            };

            await onComplete(nextConfig, {
                targetPath: selectedPath,
                handles: { core: coreH, commands: commandsH, workspace: workspaceH, library: libraryH }
            });
        } catch (err: any) {
            console.log("Picker cancelled or failed", err);
            setError("You must select the folder to grant offline access permissions.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[600px] animate-macos-expand">
                {/* Header */}
                <div className="h-16 flex items-center justify-start px-6 border-b border-slate-800 bg-slate-950 gap-4">
                    <img src="./mikuBotICON.png" alt="Logo" className="w-8 h-8 object-cover rounded shadow-inner" />
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-wider">MikuCentral Setup</h2>
                        <p className="text-xs text-slate-500">First Run Initialization</p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center">

                    {step === 1 && (
                        <div className="w-full h-full flex flex-col items-center text-center justify-center space-y-6">
                            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                                <Icon name="robot" className="text-5xl text-blue-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-white">Welcome to MikuCentral</h1>
                            <p className="text-slate-400 max-w-md">
                                The Neural AI Interface for Multi-Model Management. Before you start, we need to set up your environment, prepare the neural core base, and select your AI providers.
                            </p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-bold text-white mb-2">Environment Setup</h1>
                                <p className="text-slate-400 text-sm">Select where MikuCentral should store your neural logic, tools, and workspaces.</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setPathMode('default')}
                                    className={`w-full p-4 rounded-xl border flex items-start gap-4 transition-all text-left ${pathMode === 'default' ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <Icon name={pathMode === 'default' ? 'dot-circle' : 'circle'} className={`text-xl mt-0.5 ${pathMode === 'default' ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <div>
                                        <div className="font-bold text-white mb-1">Default Path (Recommended)</div>
                                        <div className="text-xs text-slate-400 font-mono break-all">{defaultPath}</div>
                                        <div className="text-xs text-slate-500 mt-2">Automatically creates 'core', 'commands', 'workspace', and 'library' folders inside.</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setPathMode('custom')}
                                    className={`w-full p-4 rounded-xl border flex items-start gap-4 transition-all text-left ${pathMode === 'custom' ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <Icon name={pathMode === 'custom' ? 'dot-circle' : 'circle'} className={`text-xl mt-0.5 ${pathMode === 'custom' ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <div className="w-full">
                                        <div className="font-bold text-white mb-1">Custom Path</div>
                                        <div className="text-xs text-slate-400 mb-2">Choose your own directory to store the agent framework.</div>
                                    </div>
                                </button>

                                {pathMode === 'custom' && (
                                    <div className="animate-fade-in bg-slate-800/80 p-3 rounded-lg flex items-center gap-2 border border-slate-700">
                                        <input
                                            value={customPath}
                                            onChange={(e) => setCustomPath(e.target.value)}
                                            placeholder="C:\\Path\\To\\Folder"
                                            className="bg-transparent border-none outline-none text-white text-sm flex-1 font-mono"
                                        />
                                        {(window as any).electron && (
                                            <button
                                                onClick={async () => {
                                                    const res = await (window as any).electron.selectFolder();
                                                    if (res.ok) setCustomPath(res.path);
                                                }}
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-blue-600 rounded text-xs font-bold text-white transition-colors flex items-center gap-2"
                                            >
                                                <Icon name="folder-open" /> Browse
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mt-4 flex items-start gap-3">
                                <Icon name="info-circle" className="text-amber-400 text-lg flex-shrink-0" />
                                <div className="text-xs text-amber-200/80 leading-relaxed">
                                    The core system files (base personality and instructions) will be automatically extracted and copied into the <code className="bg-amber-500/20 px-1 rounded">commands</code> folder for you.
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Providers & API Keys</h1>
                                <p className="text-slate-400 text-sm">Configure your preferred AI providers to power the engine. (These can be changed later)</p>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./geminiICON.png" alt="Gemini" className="w-4 h-4 object-contain" /> Google Gemini (Primary)
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.gemini}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, gemini: e.target.value } })}
                                        placeholder="AIzaSy..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./groqICON.png" alt="Groq" className="w-4 h-4 object-contain brightness-0 invert" /> Groq (Speed Inference)
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.groq}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, groq: e.target.value } })}
                                        placeholder="gsk_..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./ollamaICON.webp" alt="Ollama" className="w-4 h-4 object-contain brightness-0 invert" /> Ollama URL (Local Models)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.ollamaUrl}
                                        onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                                        placeholder="http://localhost:11434"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="text-red-400 text-xs text-center border border-red-500/30 bg-red-900/20 py-2 rounded">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in text-center">
                            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                                <Icon name="link" className="text-4xl text-emerald-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">Wake Up Linkages</h1>
                            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                MikuCentral operates with <strong>strict offline privacy</strong>. To protect your system, modern web browsers require your explicit permission to access local files.
                            </p>

                            <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 text-left">
                                <div className="text-sm text-slate-300 font-medium mb-2">Final Step:</div>
                                <ol className="list-decimal list-inside text-sm text-slate-400 space-y-2">
                                    <li>Click the <strong>Wake Up Core</strong> button below.</li>
                                    <li>A native folder picker will open.</li>
                                    <li>Select the <code className="text-emerald-400 font-bold bg-emerald-400/10 px-1 rounded">mikuCentral</code> folder we just created at: <br /><code className="text-xs text-slate-500 block mt-1 break-all bg-slate-900 p-2 rounded">{selectedPath}</code></li>
                                    <li>Click "Select Folder" and "View Files" (or "Save Changes") in the browser popup.</li>
                                </ol>
                            </div>

                            {error && (
                                <div className="text-red-400 text-xs mt-4 bg-red-900/20 py-2 rounded">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${step === i ? 'bg-blue-500 w-4' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button
                                onClick={handlePrev}
                                disabled={loading}
                                className="px-6 py-2 rounded-lg font-bold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Back
                            </button>
                        )}
                        {step < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={loading || (step === 2 && !selectedPath)}
                                className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading && step === 2 ? <Icon name="spinner" className="animate-spin" /> : 'Continue'}
                            </button>
                        ) : (
                            <button
                                onClick={finishWithLinkages}
                                disabled={loading}
                                className="px-8 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? <Icon name="spinner" className="animate-spin" /> : <Icon name="plug" />}
                                Wake Up Core
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
