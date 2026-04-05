import React, { useEffect, useState } from 'react';
import { Icon } from './Common';
import { useTranslation } from 'react-i18next';

export interface SystemDialogConfig {
    isOpen: boolean;
    type: 'alert' | 'confirm';
    message: string;
    resolve: (value: boolean) => void;
    position?: 'left' | 'right' | 'center';
}

interface SystemDialogProps {
    config: SystemDialogConfig | null;
}

export const SystemDialog = ({ config }: SystemDialogProps) => {
    const { t } = useTranslation();
    const [isClosing, setIsClosing] = useState(false);
    const [activeConfig, setActiveConfig] = useState<SystemDialogConfig | null>(null);

    useEffect(() => {
        if (config?.isOpen) {
            setActiveConfig(config);
            setIsClosing(false);
        } else if (activeConfig && !config?.isOpen) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setActiveConfig(null);
                setIsClosing(false);
            }, 300); // Wait for shrink animation
            return () => clearTimeout(timer);
        }
    }, [config, activeConfig]);

    if (!activeConfig) return null;

    const handleClose = (value: boolean) => {
        activeConfig.resolve(value);
    };

    const isAlert = activeConfig.type === 'alert';
    const isError = activeConfig.message.includes('❌') || activeConfig.message.includes('⚠️') || activeConfig.message.includes('💥') || activeConfig.message.includes('🔴') || activeConfig.message.includes('🛑');
    const isSuccess = activeConfig.message.includes('✅') || activeConfig.message.includes('🚀');
    const isInfo = activeConfig.message.includes('☕') || activeConfig.message.includes('♻️') || activeConfig.message.includes('ℹ️');

    const iconName = isError ? 'exclamation-triangle' : isSuccess ? 'check-circle' : isInfo ? 'info-circle' : isAlert ? 'info-circle' : 'question-circle';
    const iconColor = isError ? 'text-red-400 border-red-500/20 bg-red-500/10' : isSuccess ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : isInfo ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' : 'text-blue-400 border-blue-500/20 bg-blue-500/10';

    const isRight = activeConfig.position === 'right';
    const isLeft = activeConfig.position === 'left';

    const enterAnim = isRight ? 'animate-dialog-enter-right' : isLeft ? 'animate-dialog-enter-left' : 'animate-macos-expand-bottom';
    const exitAnim = isRight ? 'animate-dialog-exit-right' : isLeft ? 'animate-dialog-exit-left' : 'animate-macos-shrink-bottom';

    const positionClasses = isRight ? 'justify-center xl:justify-end xl:pr-12' : isLeft ? 'justify-center xl:justify-start xl:pl-12' : 'justify-center';

    return (
        <div className={`fixed inset-0 z-[200] flex items-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'} ${positionClasses}`}>
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => isAlert ? handleClose(true) : handleClose(false)} />

            <div className={`relative w-full max-w-sm bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col ${isClosing ? exitAnim : enterAnim}`}>
                {/* Header */}
                <div className="h-14 flex items-center gap-3 px-5 border-b border-slate-800 bg-slate-900/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${iconColor}`}>
                        <Icon name={iconName} className="text-lg" />
                    </div>
                    <span className="font-bold text-white uppercase tracking-wider text-sm">
                        {isError ? t('common.system_alert') : isAlert ? t('common.system_notice') : t('common.system_request')}
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {activeConfig.message.replace(/^[❌⚠️💥✅🔴☕🚀🛑♻️ℹ️]\s*/, '')}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                    {!isAlert && (
                        <button
                            onClick={() => handleClose(false)}
                            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium"
                        >
                            {t('common.cancel')}
                        </button>
                    )}
                    <button
                        onClick={() => handleClose(true)}
                        className={`px-4 py-2 rounded-xl text-white shadow-md transition-colors text-sm font-medium flex items-center gap-2 ${isError ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : isSuccess ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'}`}
                    >
                        {isAlert ? t('common.ok') : t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
