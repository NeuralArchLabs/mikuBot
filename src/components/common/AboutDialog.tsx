import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Common';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../constants';

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [isClosing, setIsClosing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
        } else if (isVisible && !isOpen) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsClosing(false);
            }, 300); // Matches exit animation
            return () => clearTimeout(timer);
        }
    }, [isOpen, isVisible]);

    if (!isVisible) return null;

    const handleClose = () => {
        onClose();
    };

    return createPortal(
        <div className={`fixed inset-0 z-[900] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleClose} />

            <div className={`relative w-full max-w-md bg-[#1e293b] border border-slate-700/60 shadow-[0_0_50px_-12px_rgba(34,211,238,0.15)] rounded-2xl overflow-hidden flex flex-col ${isClosing ? 'animate-macos-shrink-bottom' : 'animate-macos-expand-bottom'}`}>
                {/* Header pattern & Logo */}
                <div className="relative h-28 bg-[#0f172a] overflow-hidden flex items-center justify-center border-b border-cyan-900/30">
                    <div className="absolute inset-0 opacity-20 about-pattern" />
                    <img src="./mikuBotICON.png" alt="mikuBot Logo" className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] filter brightness-110 rounded-xl" />
                </div>

                {/* Body Content */}
                <div className="p-8 text-center bg-gradient-to-b from-slate-900 via-[#1e293b] object-contain">
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 mb-1">
                        mikuBot Dashboard
                    </h2>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
                        v{APP_VERSION}
                    </div>
                    
                    <p className="text-sm text-slate-300 leading-relaxed mb-6 font-medium text-justify">
                        {t('about.description')}
                    </p>

                    <div className="flex flex-col gap-2 text-xs font-mono text-slate-500 bg-slate-900/50 p-4 rounded-xl text-left border border-slate-800/80">
                        <div className="flex justify-between">
                            <span>{t('about.author')}:</span>
                            <span className="text-slate-300">J.A. Martínez / <a href="https://github.com/NeuralArchLabs" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors cursor-pointer">Neural Arch Labs</a></span>
                        </div>
                        <div className="flex justify-between">
                            <span>{t('about.repository')}:</span>
                            <a href="https://github.com/NeuralArchLabs/mikuBot" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline">
                                /NeuralArchLabs/mikuBot
                            </a>
                        </div>
                        <div className="flex justify-between">
                            <span>{t('about.audio_engine')}:</span>
                            <a href={t('about.vosk_url')} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 hover:underline">
                                Vosk
                            </a>
                        </div>
                        <div className="flex justify-between">
                            <span>{t('about.search_engine')}:</span>
                            <a href={t('about.searxena_url')} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline">
                                searXena
                            </a>
                        </div>
                        <div className="flex justify-between">
                            <span>{t('about.security_layer')}:</span>
                            <span className="text-rose-400">{t('about.security_sandbox')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{t('about.python_runtime')}:</span>
                            <span className="text-blue-400">{t('about.python_runtime_internal')}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-[#0f172a] flex justify-center">
                    <button
                        onClick={handleClose}
                        className="w-full px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all text-sm font-bold tracking-widest shadow-lg shadow-black/20 border border-slate-700"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
