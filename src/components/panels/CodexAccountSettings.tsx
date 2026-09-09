import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Common';
import './CodexAccountSettings.css';

interface RateWindow {
    usedPercent?: number | null;
    windowDurationMins?: number | null;
    resetsAt?: number | null;
}

interface RateLimit {
    limitId?: string | null;
    limitName?: string | null;
    primary?: RateWindow | null;
    secondary?: RateWindow | null;
}

interface CodexStatus {
    available: boolean;
    account: { type: string; email?: string; planType?: string } | null;
    loginPending: boolean;
    error?: string;
    rateLimits?: {
        rateLimits?: RateLimit | null;
        rateLimitsByLimitId?: Record<string, RateLimit> | null;
    };
}

interface CodexAccountSettingsProps {
    onAccountChange: (connected: boolean) => void;
    onRefreshModels: () => void;
}

/** Account credentials stay in the desktop Codex service, never in AppConfig. */
export const CodexAccountSettings = ({ onAccountChange, onRefreshModels }: CodexAccountSettingsProps) => {
    const { t, i18n } = useTranslation();
    const [status, setStatus] = useState<CodexStatus | null>(null);
    const [busy, setBusy] = useState<'loading' | 'login' | 'cancel' | 'logout' | 'refresh' | null>('loading');
    const [error, setError] = useState('');
    const mounted = useRef(false);
    const requestSequence = useRef(0);
    const accountIdentity = useRef('');
    const callbacks = useRef({ onAccountChange, onRefreshModels });
    callbacks.current = { onAccountChange, onRefreshModels };

    const readStatus = useCallback(async (refreshModels = false) => {
        const request = ++requestSequence.current;
        const desktop = (window as any).electron;
        if (!desktop?.codexGetStatus) {
            if (mounted.current) {
                setStatus({ available: false, account: null, loginPending: false });
                callbacks.current.onAccountChange(false);
            }
            return;
        }
        const next: CodexStatus = await desktop.codexGetStatus();
        if (!mounted.current || request !== requestSequence.current) return;
        setStatus(next);
        setError(next.error || '');
        const connected = next.account?.type === 'chatgpt';
        callbacks.current.onAccountChange(connected);
        const identity = connected ? `${next.account?.email || 'chatgpt'}:${next.account?.planType || ''}` : '';
        const changed = identity !== accountIdentity.current;
        accountIdentity.current = identity;
        if (changed || (connected && refreshModels)) callbacks.current.onRefreshModels();
    }, []);

    useEffect(() => {
        mounted.current = true;
        void readStatus()
            .catch((cause: unknown) => { if (mounted.current) setError(String(cause instanceof Error ? cause.message : cause)); })
            .finally(() => { if (mounted.current) setBusy(null); });
        return () => { mounted.current = false; requestSequence.current += 1; };
    }, [readStatus]);

    // The official login flow completes in the browser. Poll only while it is pending.
    useEffect(() => {
        if (!status?.loginPending || busy) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                await readStatus();
            } catch (cause) {
                if (!cancelled) setError(String(cause instanceof Error ? cause.message : cause));
            }
            if (!cancelled) timer = setTimeout(poll, 2000);
        };
        timer = setTimeout(poll, 1500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [status?.loginPending, busy, readStatus]);

    const runAction = async (action: 'login' | 'cancel' | 'logout' | 'refresh') => {
        if (busy) return;
        setBusy(action);
        setError('');
        requestSequence.current += 1;
        try {
            const desktop = (window as any).electron;
            if (action === 'login') {
                await desktop.codexLogin();
                if (mounted.current) setStatus(previous => ({
                    available: true, account: previous?.account || null, loginPending: true
                }));
            } else if (action === 'cancel') {
                await desktop.codexCancelLogin();
            } else if (action === 'logout') {
                await desktop.codexLogout();
            }
            await readStatus(action === 'refresh');
        } catch (cause) {
            if (mounted.current) setError(String(cause instanceof Error ? cause.message : cause));
        } finally {
            if (mounted.current) setBusy(null);
        }
    };

    const connected = status?.account?.type === 'chatgpt';
    const byId = status?.rateLimits?.rateLimitsByLimitId;
    const rateLimits: Array<[string, RateLimit]> = byId && Object.keys(byId).length
        ? Object.entries(byId)
        : status?.rateLimits?.rateLimits ? [['codex', status.rateLimits.rateLimits]] : [];
    const durationLabel = (minutes?: number | null) => {
        if (!minutes || !Number.isFinite(minutes)) return t('settings.codex.usage_window');
        if (minutes % 1440 === 0) return t('settings.codex.window_days', { count: minutes / 1440 });
        if (minutes % 60 === 0) return t('settings.codex.window_hours', { count: minutes / 60 });
        return t('settings.codex.window_minutes', { count: minutes });
    };
    const buttonClass = 'rounded-xl px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <section id="codex-account-settings" className="premium-card premium-emerald rounded-3xl p-5 md:p-6 space-y-4 scroll-mt-4" aria-labelledby="codex-account-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 id="codex-account-title" className="font-black text-base text-[var(--text-primary)] flex items-center gap-2">
                        <img src="./chatgptICON.png" alt="ChatGPT" className="h-7 w-7 rounded-lg object-contain" /> {t('settings.codex.title')}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">{t('settings.codex.description')}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">{t('settings.codex.deep_research_note')}</p>
                </div>
                <span className={`text-xs font-bold rounded-lg px-3 py-1.5 ${connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--surface-color)] text-[var(--text-secondary)]'}`} role="status">
                    {busy === 'loading' ? t('common.loading') : status?.loginPending ? t('settings.codex.pending') : connected ? t('settings.codex.connected') : t('settings.codex.disconnected')}
                </span>
            </div>

            {connected && (
                <div className="text-sm text-[var(--text-primary)] break-words">
                    <span className="font-semibold">{status?.account?.email || t('settings.codex.title')}</span>
                    {status?.account?.planType && <span className="ml-2 text-xs text-[var(--text-secondary)]">{status.account.planType}</span>}
                </div>
            )}
            {status?.loginPending && <p className="text-xs text-[var(--text-secondary)]" role="status">{t('settings.codex.browser_pending')}</p>}
            {status && !status.available && <p className="text-xs text-amber-500">{t('settings.codex.unavailable')}</p>}
            {error && <p role="alert" className="text-xs text-red-400 whitespace-pre-wrap break-words">{error}</p>}

            <div className="flex flex-wrap gap-2">
                {status?.loginPending ? (
                    <button type="button" onClick={() => void runAction('cancel')} disabled={!!busy} className={`${buttonClass} bg-[var(--surface-color)] text-[var(--text-primary)] hover:bg-[var(--hover-color)]`}>
                        {busy === 'cancel' ? t('common.processing') : t('settings.codex.cancel_login')}
                    </button>
                ) : connected ? (
                    <button type="button" onClick={() => void runAction('logout')} disabled={!!busy} className={`${buttonClass} bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
                        {busy === 'logout' ? t('common.processing') : t('settings.codex.logout')}
                    </button>
                ) : (
                    <button type="button" onClick={() => void runAction('login')} disabled={!!busy || !status?.available} className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`}>
                        <Icon name={busy === 'login' ? 'spinner fa-spin' : 'external-link-alt'} className="mr-2" />
                        {busy === 'login' ? t('common.processing') : t('settings.codex.login')}
                    </button>
                )}
                <button type="button" onClick={() => void runAction('refresh')} disabled={!!busy} className={`${buttonClass} bg-[var(--surface-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-color)]`}>
                    <Icon name={busy === 'refresh' ? 'sync fa-spin' : 'sync'} className="mr-2" /> {t('settings.codex.refresh')}
                </button>
            </div>

            {connected && (
                <div className="space-y-3 pt-1">
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">{t('settings.codex.limits_title')}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">{t('settings.codex.limits_description')}</p>
                    {rateLimits.length ? rateLimits.map(([id, limit]) => (
                        <div key={id} className="space-y-2">
                            <div className="text-xs font-semibold text-[var(--text-secondary)]">{limit.limitName || limit.limitId || id}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(['primary', 'secondary'] as const).filter(key => limit[key]).map(key => {
                                    const window = limit[key]!;
                                    const used = typeof window.usedPercent === 'number' && Number.isFinite(window.usedPercent)
                                        ? Math.min(100, Math.max(0, window.usedPercent)) : null;
                                    const reset = typeof window.resetsAt === 'number' ? new Date(window.resetsAt * 1000) : null;
                                    return (
                                        <div key={key} className="rounded-xl bg-[var(--surface-color)] p-3 space-y-2">
                                            <div className="flex flex-wrap justify-between gap-2 text-xs">
                                                <span className="text-[var(--text-secondary)]">{durationLabel(window.windowDurationMins)}</span>
                                                <strong className="text-[var(--text-primary)]">{used === null ? t('settings.codex.usage_unavailable') : t('settings.codex.remaining', { percent: Math.round((100 - used) * 10) / 10 })}</strong>
                                            </div>
                                            {used !== null && <progress className="codex-usage-progress w-full" max={100} value={100 - used} aria-label={t('settings.codex.remaining', { percent: Math.round((100 - used) * 10) / 10 })} />}
                                            {reset && !Number.isNaN(reset.getTime()) && <p className="text-[10px] text-[var(--text-secondary)]">{t('settings.codex.resets', { date: reset.toLocaleString(i18n.language) })}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )) : <p className="text-xs text-[var(--text-secondary)]">{t('settings.codex.usage_unavailable')}</p>}
                </div>
            )}
        </section>
    );
};
