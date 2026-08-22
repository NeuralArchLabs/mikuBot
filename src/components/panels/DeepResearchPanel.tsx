import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentMode, AppConfig, MessageBlock } from '../../types';
import { useAgentStore } from '../../stores/useAgentStore';
import { Icon, MarkdownRenderer } from '../common/Common';
import { toHtml } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';
import i18n from '../../i18n';

export type ResearchPlan = {
    objectives?: string[];
    steps?: string[];
};

export type ResearchRuntime = {
    provider: string;
    model: string;
};

export type ResearchPayload = {
    success?: boolean;
    status?: string;
    stage?: string;
    topic?: string;
    plan?: ResearchPlan;
    session_id?: string;
    created_at?: number;
    runtime?: ResearchRuntime;
    checkpoint?: { session_id?: string; phase?: string; plan?: ResearchPlan; runtime?: ResearchRuntime };
    resume_available?: boolean;
    final_report?: string;
    markdown_path?: string | null;
    markdown_filename?: string | null;
    markdown_error?: string | null;
    visited_pages?: Array<string | { url?: string; title?: string }>;
    discarded_pages?: unknown[];
    timeline?: string[];
    error?: string;
    reflections?: Record<string, string>;
    run_started_at?: number;
};

export function unwrapResearchPayload(value: unknown): ResearchPayload | null {
    let current: any = value;
    for (let depth = 0; depth < 6; depth += 1) {
        if (typeof current === 'string') {
            try {
                current = JSON.parse(current);
                continue;
            } catch {
                return null;
            }
        }
        if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
        if ('status' in current || 'plan' in current || 'final_report' in current || 'checkpoint' in current) return current as ResearchPayload;
        if ('data' in current && current.data !== current) {
            current = current.data;
            continue;
        }
        return null;
    }
    return null;
}

function makeFallbackResearchSessionId(topic: string) {
    const topicToken = topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'research';
    return `research_${topicToken}_${Date.now().toString(36)}`.slice(0, 120);
}

function validResearchRuntime(runtime: ResearchRuntime | undefined): runtime is ResearchRuntime {
    return Boolean(runtime?.provider?.trim() && runtime?.model?.trim());
}

function normalizedResearchPlan(plan?: ResearchPlan | null) {
    if (!plan) return null;
    const normalizeList = (items?: string[]) => (Array.isArray(items) ? items : [])
        .map(item => String(item).replace(/\s+/g, ' ').trim());
    const objectives = normalizeList(plan.objectives);
    const steps = normalizeList(plan.steps);
    return { objectives, steps, hasContent: objectives.length > 0 || steps.length > 0 };
}

/** Prevent a replayed tool call from adopting a different historical run. */
function progressMatchesProposal(progress: ResearchPayload | null | undefined, proposal: ResearchPayload | null | undefined) {
    if (!progress || !proposal) return false;
    const storedPlan = progress.plan || progress.checkpoint?.plan;
    const normalizedStored = normalizedResearchPlan(storedPlan);
    const normalizedProposal = normalizedResearchPlan(proposal.plan);
    if (normalizedStored?.hasContent && normalizedProposal?.hasContent) {
        return JSON.stringify(normalizedStored) === JSON.stringify(normalizedProposal);
    }
    return Boolean(progress.topic && proposal.topic && progress.topic.trim() === proposal.topic.trim());
}

function resolveModeRuntime(config: AppConfig, mode: AgentMode): ResearchRuntime | undefined {
    const provider = mode === 'agent' ? config.agentProvider : config.chatProvider;
    const model = mode === 'agent' ? config.agentModel : config.chatModel;
    return provider && model ? { provider, model } : undefined;
}

async function executeResearchSkill(config: AppConfig, sessionId: string, runtime: ResearchRuntime | undefined, args: Record<string, unknown>) {
    const api = (window as any).electron;
    if (!api?.executeSkill || !config.folderPaths?.tools) throw new Error(i18n.t('deep_research.engine_unavailable'));
    if (!validResearchRuntime(runtime)) {
        throw new Error(i18n.t('deep_research.runtime_missing'));
    }
    const response = await api.executeSkill({
        toolsPath: config.folderPaths.tools,
        skillName: 'deep_research',
        args: {
            ...args,
            _session_id: sessionId,
            _runtime: runtime,
            _config: {
                ...config,
                provider: runtime.provider,
                model: runtime.model,
                apiKeys: {}
            }
        },
        lang: config.language
    });
    if (!response?.ok) throw new Error(response?.error || i18n.t('deep_research.execution_error'));
    const payload = unwrapResearchPayload(response.data);
    if (payload?.success === false) throw new Error(payload.error || i18n.t('deep_research.skill_error'));
    return payload;
}

interface ProposalCardProps {
    block: MessageBlock;
    config: AppConfig;
    mode: AgentMode;
    interactive: boolean;
    chatSessionId: string;
}

/** Inline approval boundary matching the proposal card in searXena Agents Page. */
export const DeepResearchProposalCard: React.FC<ProposalCardProps> = ({ block, config, mode, interactive, chatSessionId }) => {
    const { t } = useTranslation();
    const detected = useMemo(() => unwrapResearchPayload(block.result), [block.result]);
    const [proposal, setProposal] = useState<ResearchPayload | null>(detected);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState('');
    const [isCheckingStoredProgress, setIsCheckingStoredProgress] = useState(true);
    const launchLockRef = useRef(false);
    const fallbackSessionIdRef = useRef<string | null>(null);
    const activeSessionId = useAgentStore(state => state.deepResearchSessionId);
    const activeProgress = useAgentStore(state => state.deepResearchProgress);
    const setIsActive = useAgentStore(state => state.setIsDeepResearchActive);
    const setProgress = useAgentStore(state => state.setDeepResearchProgress);
    const setResearchSessionId = useAgentStore(state => state.setDeepResearchSessionId);
    const setResearchChatSessionId = useAgentStore(state => state.setDeepResearchChatSessionId);

    useEffect(() => {
        setProposal(detected);
        setError('');
        setIsCheckingStoredProgress(true);
        setIsAdjusting(false);
        setFeedback('');
        fallbackSessionIdRef.current = null;
    }, [detected]);

    if (!fallbackSessionIdRef.current && proposal?.topic) {
        fallbackSessionIdRef.current = makeFallbackResearchSessionId(proposal.topic);
    }
    const researchSessionId = proposal?.session_id || fallbackSessionIdRef.current || '';

    // Chat history can be restored independently of the in-memory Zustand
    // state. Rehydrate a matching checkpoint so the card can reopen the
    // existing investigation instead of starting a duplicate run.
    useEffect(() => {
        if (!proposal?.plan || proposal.status !== 'plan_proposal' || !researchSessionId) {
            setIsCheckingStoredProgress(false);
            return;
        }
        let cancelled = false;
        const loadStoredProgress = async () => {
            const api = (window as any).electron;
            if (!api?.getDeepResearchProgress) {
                setIsCheckingStoredProgress(false);
                return;
            }
            try {
                const response = await api.getDeepResearchProgress({ sessionId: researchSessionId });
                if (cancelled) return;
                if (!response?.ok || !response.progress) return;
                const stored = response.progress as ResearchPayload;
                if (stored.status && stored.status !== 'plan_proposal' && progressMatchesProposal(stored, proposal)) {
                    setResearchSessionId(researchSessionId);
                    setResearchChatSessionId(chatSessionId);
                    setProgress((current: ResearchPayload | null) => ({
                        ...(current || {}),
                        ...stored,
                        topic: stored.topic || current?.topic || proposal.topic,
                        plan: stored.plan || stored.checkpoint?.plan || current?.plan || proposal.plan
                    }));
                    setIsActive(true);
                }
            } catch (progressError) {
                console.warn('[Deep Research] No se pudo consultar el checkpoint histórico:', progressError);
            } finally {
                if (!cancelled) setIsCheckingStoredProgress(false);
            }
        };
        void loadStoredProgress();
        return () => { cancelled = true; };
    }, [chatSessionId, proposal?.plan, proposal?.status, proposal?.topic, researchSessionId, setIsActive, setProgress, setResearchChatSessionId, setResearchSessionId]);

    if (!proposal?.plan || proposal.status !== 'plan_proposal') return null;
    // Plans are model-independent. Resolve the runtime only when the user
    // approves/adjusts so old proposals always use the mode configured now.
    const researchRuntime = resolveModeRuntime(config, mode);
    const isThisResearchActive = activeSessionId === researchSessionId
        && progressMatchesProposal(activeProgress as ResearchPayload | null, proposal);
    const matchedProgress = isThisResearchActive ? activeProgress as ResearchPayload : null;
    const isResearchCompleted = matchedProgress?.status === 'completed';
    const isResearchRunning = matchedProgress?.status === 'running';
    const displayedRuntime = validResearchRuntime(matchedProgress?.runtime)
        ? matchedProgress.runtime
        : validResearchRuntime(proposal.runtime)
            ? proposal.runtime
            : researchRuntime;
    const runtimeLabel = isResearchCompleted
        ? t('deep_research.runtime_completed')
        : isResearchRunning
            ? t('deep_research.runtime_running')
            : t('deep_research.runtime_planned');
    const showActions = interactive || isThisResearchActive;
    const actionsDisabled = isWorking || isCheckingStoredProgress;

    const approve = async () => {
        if (!proposal.topic || !proposal.plan || launchLockRef.current) return;
        if (!validResearchRuntime(researchRuntime)) {
            setError(t('deep_research.configure_runtime', { mode: mode === 'agent' ? t('chat.modes.agent') : t('chat.modes.chat') }));
            return;
        }
        if (isThisResearchActive) {
            setIsActive(true);
            return;
        }
        launchLockRef.current = true;
        setIsWorking(true);
        setError('');
        const runStartedAt = Date.now() / 1000;
        setResearchSessionId(researchSessionId);
        setResearchChatSessionId(chatSessionId);
        setProgress({
            status: 'running', stage: t('deep_research.stage_planning'), topic: proposal.topic, plan: proposal.plan,
            visited_pages: [], discarded_pages: [],
            timeline: [t('deep_research.approved_timeline')],
            runtime: researchRuntime,
            checkpoint: { session_id: researchSessionId, phase: 'planning', plan: proposal.plan, runtime: researchRuntime },
            run_started_at: runStartedAt
        });
        setIsActive(true);
        try {
            const payload = await executeResearchSkill(config, researchSessionId, researchRuntime, { topic: proposal.topic, plan: proposal.plan, approved: true });
            if (payload) setProgress((current: ResearchPayload | null) => ({
                ...(current || {}),
                ...payload,
                status: payload.status || (payload.final_report ? 'completed' : current?.status),
                topic: payload.topic || current?.topic,
                plan: payload.plan || current?.plan,
                run_started_at: current?.run_started_at
            }));
        } catch (caught: any) {
            setProgress((current: ResearchPayload | null) => ({ ...(current || {}), status: 'failed', error: caught?.message || t('deep_research.research_interrupted'), resume_available: true }));
        } finally {
            launchLockRef.current = false;
            setIsWorking(false);
        }
    };

    const adjust = async () => {
        if (!proposal.topic || !feedback.trim() || launchLockRef.current) return;
        if (!validResearchRuntime(researchRuntime)) {
            setError(t('deep_research.configure_adjustments_runtime', { mode: mode === 'agent' ? t('chat.modes.agent') : t('chat.modes.chat') }));
            return;
        }
        launchLockRef.current = true;
        setIsWorking(true);
        setError('');
        try {
            const payload = await executeResearchSkill(config, researchSessionId, researchRuntime, { topic: proposal.topic, feedback: feedback.trim(), approved: false });
            if (payload?.status === 'plan_proposal' && payload.plan) {
                setProposal(payload);
                setFeedback('');
                setIsAdjusting(false);
            }
        } catch (caught: any) {
            setError(caught?.message || t('deep_research.adjust_error'));
        } finally {
            launchLockRef.current = false;
            setIsWorking(false);
        }
    };

    return (
        <section className="mt-4 rounded-xl border border-emerald-400/25 bg-slate-950/55 p-4 shadow-xl shadow-black/20">
            <header className="flex items-start gap-3 border-b border-white/10 pb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Icon name="clipboard-list" /></div>
                <div className="min-w-0"><h3 className="text-sm font-bold text-emerald-300">{isResearchCompleted ? t('deep_research.plan_title') : t('deep_research.plan_title_proposed')}</h3><p className="mt-0.5 text-[11px] text-slate-400">{proposal.topic}</p>{validResearchRuntime(displayedRuntime) && <p className="mt-1 truncate text-[10px] text-cyan-300/70">{runtimeLabel} {displayedRuntime.provider} · {displayedRuntime.model}</p>}</div>
            </header>
            {!!proposal.plan.objectives?.length && <div className="mt-4"><h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('deep_research.objectives')}</h4><ul className="space-y-2 text-xs text-slate-200">{proposal.plan.objectives.map((objective, index) => <li key={`${objective}-${index}`} className="flex gap-2"><span className="text-emerald-400">•</span><span>{objective}</span></li>)}</ul></div>}
            {!!proposal.plan.steps?.length && <div className="mt-4 space-y-2"><h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('deep_research.work_phases')}</h4>{proposal.plan.steps.map((step, index) => <div key={`${step}-${index}`} className="flex gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2 text-xs text-slate-200"><span className="font-bold text-emerald-400">{index + 1}</span><span>{step.replace(/^\d+\.\s*/, '')}</span></div>)}</div>}
            {error && <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-xs text-rose-200">{error}</p>}
            {showActions && <div className="mt-4 border-t border-white/10 pt-3">{!isAdjusting || isThisResearchActive ? <div className="flex gap-2"><button onClick={() => void approve()} disabled={actionsDisabled} className="flex-1 rounded-lg bg-emerald-500 px-3 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"><Icon name={isThisResearchActive ? 'eye' : 'play'} className="mr-2" />{isThisResearchActive ? t('deep_research.open_investigation') : isCheckingStoredProgress ? t('deep_research.checking') : isWorking ? t('deep_research.starting') : t('deep_research.approve_start')}</button>{!isThisResearchActive && <button onClick={() => setIsAdjusting(true)} disabled={actionsDisabled} className="rounded-lg border border-white/15 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50">{t('deep_research.request_adjustments')}</button>}</div> : <div className="space-y-2"><textarea value={feedback} onChange={event => setFeedback(event.target.value)} placeholder={t('deep_research.adjust_placeholder')} className="min-h-24 w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-100 outline-none focus:border-emerald-400/50" /><div className="flex justify-end gap-2"><button onClick={() => setIsAdjusting(false)} className="px-3 py-2 text-xs text-slate-400 hover:text-white">{t('deep_research.cancel')}</button><button onClick={() => void adjust()} disabled={!feedback.trim() || actionsDisabled} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{isWorking ? t('deep_research.starting') : t('deep_research.send_adjustments')}</button></div></div>}</div>}
        </section>
    );
};

function resolveStageIndex(stage?: string) {
    const value = String(stage || '').toLowerCase();
    if (/revisi|smart|patch|síntesis|sintesis|redacci|writing/.test(value)) return 3;
    if (/verific|audit/.test(value)) return 2;
    if (/ejecuci|descubr|búsqueda|busqueda|expansi|discovery/.test(value)) return 1;
    return 0;
}

export const DeepResearchPanel: React.FC<{ config: AppConfig; mode: AgentMode; sessionId: string; onLibrarySaved?: () => void | Promise<unknown> }> = ({ config, mode, sessionId, onLibrarySaved }) => {
    const { t } = useTranslation();
    const isActive = useAgentStore(state => state.isDeepResearchActive);
    const progress = useAgentStore(state => state.deepResearchProgress) as ResearchPayload | null;
    const researchSessionId = useAgentStore(state => state.deepResearchSessionId);
    const researchChatSessionId = useAgentStore(state => state.deepResearchChatSessionId);
    const setIsActive = useAgentStore(state => state.setIsDeepResearchActive);
    const setProgress = useAgentStore(state => state.setDeepResearchProgress);
    const setPanelTransitioning = useAgentStore(state => state.setIsDeepResearchPanelTransitioning);
    const [isResuming, setIsResuming] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [pdfNotice, setPdfNotice] = useState('');
    const syncedMarkdownPathRef = useRef('');
    const [isPanelMounted, setIsPanelMounted] = useState(false);
    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const hasCurrentResearch = Boolean(progress && researchSessionId && researchChatSessionId === sessionId);
    const shouldShowPanel = isActive && hasCurrentResearch;

    useEffect(() => {
        if (shouldShowPanel) {
            setPanelTransitioning(true);
            setIsPanelMounted(true);
            setIsPanelClosing(false);
            return;
        }

        if (!isPanelMounted) {
            setPanelTransitioning(false);
            return;
        }
        setPanelTransitioning(true);
        setIsPanelClosing(true);
        const timer = window.setTimeout(() => {
            setIsPanelMounted(false);
            setIsPanelClosing(false);
            setPanelTransitioning(false);
        }, 360);
        return () => window.clearTimeout(timer);
    }, [isPanelMounted, setPanelTransitioning, shouldShowPanel]);

    useEffect(() => () => setPanelTransitioning(false), [setPanelTransitioning]);

    const readProgress = useCallback(async () => {
        const api = (window as any).electron;
        if (!api?.getDeepResearchProgress || !researchSessionId) return;
        const response = await api.getDeepResearchProgress({ sessionId: researchSessionId });
        if (!response?.ok || !response.progress) return;
        const next = response.progress as ResearchPayload;
        const checkpointSessionId = next.checkpoint?.session_id;
        if (checkpointSessionId && checkpointSessionId !== researchSessionId) return;
        if (progress?.topic && next.topic && progress.topic !== next.topic) return;
        setProgress((current: ResearchPayload | null) => ({
            ...(current || {}),
            ...next,
            topic: next.topic || current?.topic,
            plan: next.plan || next.checkpoint?.plan || current?.plan,
            run_started_at: current?.run_started_at
        }));
    }, [progress?.topic, researchSessionId, setProgress]);

    useEffect(() => {
        // Keep polling even if the user is viewing another chat. The global
        // research job may finish in the background and must still emit its
        // persisted completion notice into the originating session.
        if (progress?.status !== 'running' || !researchSessionId) return;
        void readProgress();
        const timer = window.setInterval(() => void readProgress(), 1000);
        return () => window.clearInterval(timer);
    }, [progress?.status, readProgress, researchSessionId]);

    useEffect(() => {
        const markdownPath = progress?.status === 'completed' ? String(progress.markdown_path || '') : '';
        if (!markdownPath || syncedMarkdownPathRef.current === markdownPath) return;
        syncedMarkdownPathRef.current = markdownPath;
        void onLibrarySaved?.();
    }, [onLibrarySaved, progress?.markdown_path, progress?.status]);

    const exportReportToPdf = useCallback(async () => {
        if (!progress?.final_report || isExportingPdf) return;
        setIsExportingPdf(true);
        setPdfNotice('');
        const tempDiv = document.createElement('div');
        tempDiv.className = 'markdown-body';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = '850px';
        tempDiv.innerHTML = toHtml(formatFinalResponse(progress.final_report), false, 'full');
        document.body.appendChild(tempDiv);

        try {
            try {
                const { renderMermaidBlocks } = await import('../../utils/helpers/mermaid');
                await renderMermaidBlocks(tempDiv);
                await new Promise(resolve => window.setTimeout(resolve, 400));
            } catch (mermaidError) {
                console.error('[Deep Research PDF] Mermaid rendering failed:', mermaidError);
            }

            const html = tempDiv.innerHTML;
            let cssRules = '';
            try {
                cssRules = Array.from(document.styleSheets).map(sheet => {
                    try {
                        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
                    } catch {
                        return '';
                    }
                }).join('\n');
            } catch {
                cssRules = '';
            }

            const api = (window as any).electron;
            if (!api?.exportHtmlToPdf) throw new Error(t('deep_research.pdf_unavailable'));
            const safeTopic = String(progress.topic || 'investigacion').replace(/[\\/*?:"<>|]/g, '_').slice(0, 70);
            const suggestedPdfPath = progress.markdown_path
                ? progress.markdown_path.replace(/\.md$/i, '.pdf')
                : undefined;
            const result = await api.exportHtmlToPdf({
                html,
                title: `Investigacion_${safeTopic}`,
                defaultPath: suggestedPdfPath,
                cssRules,
                bodyClass: document.body.className,
                htmlClass: document.documentElement.className,
                bodyStyle: document.body.getAttribute('style') || '',
                htmlStyle: document.documentElement.getAttribute('style') || ''
            });
            if (result?.ok) setPdfNotice(t('deep_research.pdf_saved', { path: result.path }));
            else if (!result?.canceled) throw new Error(result?.error || t('deep_research.execution_error'));
        } catch (caught: any) {
            setPdfNotice(t('deep_research.pdf_error', { error: caught?.message || t('common.error') }));
        } finally {
            tempDiv.remove();
            setIsExportingPdf(false);
        }
    }, [isExportingPdf, progress?.final_report, progress?.markdown_path, progress?.topic, t]);

    const resume = async () => {
        const topic = progress?.topic;
        if (!topic || !researchSessionId || isResuming) return;
        // Resume is an operational action, not part of the plan. Always use
        // the model configured for the mode active at the moment of resuming.
        const runtime = resolveModeRuntime(config, mode);
        if (!validResearchRuntime(runtime)) {
            setProgress({ ...(progress || {}), status: 'failed', resume_available: true, error: t('deep_research.configure_runtime', { mode: mode === 'agent' ? t('chat.modes.agent') : t('chat.modes.chat') }) });
            return;
        }
        setIsResuming(true);
        setProgress({ ...(progress || {}), status: 'running', stage: t('deep_research.resume_stage'), resume_available: false });
        try {
            const payload = await executeResearchSkill(config, researchSessionId, runtime, { topic, approved: true, resume: true, plan: progress?.checkpoint?.plan });
            if (payload) setProgress((current: ResearchPayload | null) => ({
                ...(current || {}),
                ...payload,
                status: payload.status || (payload.final_report ? 'completed' : current?.status),
                topic: payload.topic || current?.topic,
                plan: payload.plan || current?.plan
            }));
        } catch (caught: any) {
            setProgress({ ...(progress || {}), status: 'failed', resume_available: true, error: caught?.message || t('deep_research.execution_error') });
        } finally {
            setIsResuming(false);
        }
    };

    if (!isPanelMounted || !progress || !researchSessionId || researchChatSessionId !== sessionId) return null;
    const isRunning = progress.status === 'running';
    const isCompleted = progress.status === 'completed';
    const isFailed = progress.status === 'failed';
    const visitedPages = Array.isArray(progress.visited_pages) ? progress.visited_pages : [];
    const timeline = Array.isArray(progress.timeline) ? progress.timeline.slice(-20).reverse() : [];
    const currentStage = resolveStageIndex(progress.stage);
    const stages = [
        t('deep_research.stage_planning'),
        t('deep_research.stage_execution'),
        t('deep_research.stage_verification'),
        t('deep_research.stage_synthesis')
    ];

    return (
        <aside className={`deep-research-panel ${isPanelClosing ? 'deep-research-panel-exit' : 'deep-research-panel-enter'} absolute inset-0 z-40 flex w-full items-center justify-center border-l-0 bg-slate-950/95 shadow-[-16px_0_48px_rgba(0,0,0,0.5)] backdrop-blur-xl xl:relative xl:inset-auto xl:z-20 xl:h-full xl:w-[48%] xl:min-w-[420px] xl:max-w-[760px] xl:items-stretch xl:justify-start xl:border-l xl:border-emerald-400/20 xl:shadow-none xl:shrink-0`}>
            <div className="deep-research-panel-surface flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
            <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900/70 px-4 py-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isRunning ? 'bg-emerald-500/20 text-emerald-300' : isCompleted ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'}`}><Icon name={isCompleted ? 'check-double' : isFailed ? 'exclamation-triangle' : 'search'} /></div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400/80">{t('deep_research.panel_title')}</p><h2 className="truncate text-sm font-bold text-slate-100" title={progress.topic}>{progress.topic || t('deep_research.research_default')}</h2>{validResearchRuntime(progress.runtime) && <p className="truncate text-[9px] text-cyan-300/60">{progress.runtime.provider} · {progress.runtime.model}</p>}</div>{isRunning && <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"><span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{progress.stage || t('deep_research.stage_planning')}</span>}{isCompleted && progress.final_report && <button onClick={() => void exportReportToPdf()} disabled={isExportingPdf} className="shrink-0 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-2 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:opacity-50" title={t('deep_research.convert_pdf_title')}><Icon name="file-pdf" className="mr-1.5" />{isExportingPdf ? t('deep_research.generating_pdf') : t('deep_research.export_pdf')}</button>}<button onClick={() => setIsActive(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white" title={t('deep_research.close_panel')}><Icon name="times" /></button></header>
            {!isCompleted && <div className="flex items-center border-b border-white/10 bg-black/20 px-4 py-3">{stages.map((stage, index) => <React.Fragment key={stage}><div className="flex flex-col items-center gap-1"><div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${index < currentStage ? 'border-emerald-500 bg-emerald-500 text-slate-950' : index === currentStage && isRunning ? 'animate-pulse border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-600'}`}>{index < currentStage ? '✓' : index + 1}</div><span className="hidden text-[8px] text-slate-500 xl:block">{stage}</span></div>{index < stages.length - 1 && <div className={`mx-1 h-px flex-1 ${index < currentStage ? 'bg-emerald-500' : 'bg-slate-700'}`} />}</React.Fragment>)}</div>}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                <div className="deep-research-panel-content mx-auto">
                {isFailed && <section className="mb-5 space-y-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-4 text-xs text-amber-100"><div className="font-bold"><Icon name="exclamation-triangle" className="mr-2" />{t('deep_research.interrupted')}</div><p className="text-amber-100/80">{progress.error || progress.reflections?.Error || t('deep_research.checkpoint_available')}</p>{progress.resume_available && <button onClick={() => void resume()} disabled={isResuming} className="rounded-lg border border-amber-300/40 px-3 py-2 font-bold hover:bg-amber-300/10 disabled:opacity-50"><Icon name="redo" className="mr-2" />{isResuming ? t('deep_research.resuming') : t('deep_research.resume_checkpoint')}</button>}</section>}
                {isCompleted && <section className={`mb-4 rounded-xl border p-3 text-[11px] ${progress.markdown_error ? 'border-rose-400/25 bg-rose-500/[0.06] text-rose-200' : 'border-emerald-400/20 bg-emerald-500/[0.05] text-emerald-200'}`}><p className="font-bold"><Icon name={progress.markdown_error ? 'exclamation-triangle' : 'file-alt'} className="mr-2" />{progress.markdown_error ? t('deep_research.markdown_failed') : t('deep_research.markdown_saved')}</p><p className="mt-1 break-all opacity-75">{progress.markdown_error || progress.markdown_path || progress.markdown_filename || t('deep_research.markdown_saved_copy')}</p>{pdfNotice && <p className={`mt-2 border-t border-white/10 pt-2 ${pdfNotice.startsWith('Error') ? 'text-rose-200' : 'text-cyan-200'}`}>{pdfNotice}</p>}</section>}
                {isCompleted && progress.final_report ? <article className="prose-invert max-w-none"><MarkdownRenderer content={progress.final_report} /></article> : <div className="space-y-5">{!!progress.plan && <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-300">{t('deep_research.approved_plan')}</h3><div className="space-y-2">{progress.plan.steps?.map((step, index) => <div key={`${step}-${index}`} className="flex gap-2 text-xs text-slate-400"><span className="font-bold text-emerald-400">{index + 1}</span><span>{step.replace(/^\d+\.\s*/, '')}</span></div>)}</div></section>}<section><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('deep_research.activity')}</h3><span className="text-[10px] text-slate-500">{t('deep_research.sources_count', { count: visitedPages.length })}</span></div>{progress.reflections && Object.keys(progress.reflections).length > 0 && (() => { const [label, note] = Object.entries(progress.reflections).filter(([, value]) => Boolean(value)).slice(-1)[0] || []; return note ? <div className="mb-3 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.05] p-3"><p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400/70">{label}</p><p className="text-xs text-slate-300">{String(note)}</p></div> : null; })()}{timeline.length ? <div className="space-y-2">{timeline.map((line, index) => <p key={`${line}-${index}`} className="border-l border-emerald-400/30 pl-3 text-[11px] text-slate-400">{line}</p>)}</div> : <p className="text-xs italic text-slate-600">{t('deep_research.preparing_log')}</p>}</section>{isRunning && progress.final_report && <section className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.03] p-4"><h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-cyan-300/70">{t('deep_research.draft_in_progress')}</h3><div className="max-h-80 overflow-hidden text-slate-400 opacity-80"><MarkdownRenderer content={progress.final_report} /></div></section>}</div>}
                {visitedPages.length > 0 && <section className="mt-6"><h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('deep_research.validated_sources', { count: visitedPages.length })}</h3><div className="space-y-2">{visitedPages.slice(0, 40).map((source, index) => { const url = typeof source === 'string' ? source : source.url || ''; const label = typeof source === 'string' ? source : source.title || source.url || t('deep_research.source_default', { count: index + 1 }); return url ? <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs text-cyan-300 hover:bg-cyan-500/10">{label}</a> : null; })}</div></section>}
                </div>
            </div>
            </div>
        </aside>
    );
};
