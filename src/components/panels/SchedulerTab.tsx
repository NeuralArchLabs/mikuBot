import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppConfig, ScheduledTask, TaskExecutionLog, TaskScheduleType, TaskChannel, TaskMode } from '../../types';
import { useTranslation } from 'react-i18next';
import { neuralScheduler } from '../../services';
import { Icon } from '../common/Common';
import { useTaskPresets } from './SchedulerPresets';

// Helpers moved inside component or passed t

const CHANNEL_ICONS: Record<TaskChannel, string> = {
    telegram: 'paper-plane',
    ui: 'desktop',
    both: 'globe',
};

const MODE_ICONS: Record<TaskMode, string> = {
    chat: 'comments',
    agent: 'bolt',
};

// ── Cron Builder Components ──────────────────────────────────────────

const SelectField = ({ label, value, options, onChange }: { label: string, value: string, options: {val:string, label:string}[], onChange: (val: string) => void }) => {
    let finalOptions = [...options];
    if (!finalOptions.find(o => o.val === value)) {
        finalOptions = [{val: value, label: value}, ...finalOptions];
    }
    
    const selectedLabel = finalOptions.find(o => o.val === value)?.label || value;
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider text-center">{label}</span>
            <div 
                className={`w-full bg-black/40 border ${isOpen ? 'border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' : 'border-white/5'} rounded-lg py-3 px-2 text-[11px] text-slate-300 font-mono flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all select-none group h-[40px]`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 w-full justify-center">
                    <span className="text-center truncate font-medium group-hover:text-white transition-colors leading-none mt-0.5">{selectedLabel}</span>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className={`text-[9px] transition-transform duration-200 ${isOpen ? 'text-cyan-400' : 'text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-slate-400'}`} />
                </div>
            </div>
            
            {isOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 max-h-48 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-cyan-800/40 rounded-lg shadow-2xl shadow-cyan-900/20 z-[100] flex flex-col py-1 custom-scrollbar ring-1 ring-white/5">
                    {finalOptions.map(o => (
                        <div 
                            key={o.val} 
                            onClick={() => { onChange(o.val); setIsOpen(false); }}
                            className={`px-3 py-2.5 text-[11px] font-mono text-center cursor-pointer transition-all border-l-2 ${value === o.val ? 'bg-cyan-500/10 text-cyan-300 font-bold border-cyan-500 shadow-[inset_2px_0_0_rgba(6,182,212,0.8)]' : 'text-slate-400 hover:bg-white/5 hover:text-white border-transparent hover:border-slate-500'}`}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CronBuilder = ({ value, onChange, t }: { value: string, onChange: (v: string) => void, t: any }) => {
    const [mode, setMode] = useState<'visual' | 'raw'>('visual');
    const p = (value || '0 8 * * *').trim().split(/\s+/);
    const parts = p.length === 5 ? p : ['0', '8', '*', '*', '*'];

    const updatePart = (index: number, val: string) => {
        const newParts = [...parts];
        newParts[index] = val;
        onChange(newParts.join(' '));
    };

    return (
        <div className="flex flex-col h-full space-y-2">
            <div className="flex justify-between items-center mb-1 shrink-0">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
                    {t('scheduler.fields.cron_label')}
                </label>
                <button 
                    onClick={() => setMode(m => m === 'visual' ? 'raw' : 'visual')} 
                    className="text-[9px] text-cyan-500 hover:text-cyan-400 transition-colors uppercase tracking-wider font-bold"
                >
                    {mode === 'visual' ? t('scheduler.cron.advanced', 'Modo Avanzado (Raw)') : t('scheduler.cron.visual', 'Modo Visual')}
                </button>
            </div>
            
            {mode === 'raw' ? (
                <div className="grow flex flex-col">
                    <input
                        type="text"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder="0 8 * * *"
                        className="w-full h-full min-h-[50px] bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                </div>
            ) : (
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-5 flex flex-col justify-center gap-5 grow min-h-[100px]">
                    <div className="grid grid-cols-2 gap-4">
                        <SelectField
                            label="Minuto"
                            value={parts[0]}
                            onChange={v => updatePart(0, v)}
                            options={[
                                { val: '*', label: '*' },
                                { val: '*/5', label: '*/5' },
                                { val: '*/10', label: '*/10' },
                                { val: '*/15', label: '*/15' },
                                { val: '*/30', label: '*/30' },
                                ...Array.from({length:60}, (_, i) => ({ val: i.toString(), label: i.toString() }))
                            ]}
                        />
                        <SelectField
                            label="Hora"
                            value={parts[1]}
                            onChange={v => updatePart(1, v)}
                            options={[
                                { val: '*', label: '*' },
                                { val: '*/2', label: '*/2' },
                                { val: '*/4', label: '*/4' },
                                { val: '*/6', label: '*/6' },
                                { val: '*/12', label: '*/12' },
                                ...Array.from({length:24}, (_, i) => ({ val: i.toString(), label: i.toString() }))
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <SelectField
                            label="Día (Mes)"
                            value={parts[2]}
                            onChange={v => updatePart(2, v)}
                            options={[
                                { val: '*', label: '*' },
                                ...Array.from({length:31}, (_, i) => ({ val: (i+1).toString(), label: (i+1).toString() }))
                            ]}
                        />
                        <SelectField
                            label="Mes"
                            value={parts[3]}
                            onChange={v => updatePart(3, v)}
                            options={[
                                { val: '*', label: '*' },
                                ...['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => ({ val: (i+1).toString(), label: (i+1).toString() + ` (${m})` }))
                            ]}
                        />
                        <SelectField
                            label="Día (Sem)"
                            value={parts[4]}
                            onChange={v => updatePart(4, v)}
                            options={[
                                { val: '*', label: '*' },
                                { val: '1-5', label: 'Lun-Vie' },
                                { val: '0,6', label: 'Sab-Dom' },
                                ...['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((m, i) => ({ val: i.toString(), label: i.toString() + ` (${m})` }))
                            ]}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Create/Edit Form ─────────────────────────────────────────────────

interface TaskFormData {
    name: string;
    prompt: string;
    scheduleType: TaskScheduleType;
    schedule: string;
    channel: TaskChannel;
    mode: TaskMode;
    enabled: boolean;
    maxExecutionsPerDay: number;
}

const EMPTY_FORM: TaskFormData = {
    name: '',
    prompt: '',
    scheduleType: 'interval',
    schedule: '30',
    channel: 'telegram',
    mode: 'chat',
    enabled: true,
    maxExecutionsPerDay: 0,
};

// Presets moved inside component to use t

// ── Main Component ───────────────────────────────────────────────────

interface SchedulerTabProps {
    config: AppConfig;
    askAlert: (message: string, position?: 'left' | 'right' | 'center') => Promise<void>;
}

export const SchedulerTab = ({ config, askAlert }: SchedulerTabProps) => {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [logs, setLogs] = useState<TaskExecutionLog[]>([]);
    const [view, setView] = useState<'tasks' | 'logs' | 'create'>('tasks');
    const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
    const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
    const [tickCounter, setTickCounter] = useState(0);

    const formatRelativeTime = useCallback((timestamp: number | null): string => {
        if (!timestamp) return t('scheduler.relative.never');
        const diff = timestamp - Date.now();
        if (diff < 0) {
            const ago = Date.now() - timestamp;
            if (ago < 60_000) return t('scheduler.relative.now');
            if (ago < 3_600_000) return t('scheduler.relative.m_ago', { count: Math.floor(ago / 60_000) });
            if (ago < 86_400_000) return t('scheduler.relative.h_ago', { count: Math.floor(ago / 3_600_000) });
            return t('scheduler.relative.d_ago', { count: Math.floor(ago / 86_400_000) });
        }
        if (diff < 60_000) return t('scheduler.relative.soon');
        if (diff < 3_600_000) return t('scheduler.relative.in_m', { count: Math.floor(diff / 60_000) });
        if (diff < 86_400_000) return t('scheduler.relative.in_h', { count: Math.floor(diff / 3_600_000) });
        return t('scheduler.relative.in_d', { count: Math.floor(diff / 86_400_000) });
    }, [t]);

    const getScheduleLabel = useCallback((task: ScheduledTask): string => {
        switch (task.scheduleType) {
            case 'interval': return t('scheduler.schedule_labels.interval', { count: task.schedule });
            case 'cron': return t('scheduler.schedule_labels.cron', { val: task.schedule });
            case 'once': return t('scheduler.schedule_labels.once', { val: new Date(task.schedule).toLocaleString() });
        }
    }, [t]);

    const PRESET_TASKS = useTaskPresets();

    // Auto-refresh every 30s to update relative times
    useEffect(() => {
        const timer = setInterval(() => setTickCounter(c => c + 1), 30_000);
        return () => clearInterval(timer);
    }, []);

    const refreshData = useCallback(() => {
        setTasks(neuralScheduler.getTasks());
        setLogs(neuralScheduler.getLogs());
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData, tickCounter]);

    useEffect(() => {
        const handler = () => refreshData();
        window.addEventListener('scheduler-data-updated', handler);
        return () => window.removeEventListener('scheduler-data-updated', handler);
    }, [refreshData]);

    const handleCreate = () => {
        if (!form.name.trim() || !form.prompt.trim()) return;

        if (form.channel === 'telegram' || form.channel === 'both') {
            if (!config.telegramBotToken || !config.telegramChatId) {
                askAlert(`${t('scheduler.alerts.telegram_incomplete_title')}\n\n${t('scheduler.alerts.telegram_incomplete_desc')}`);
                return;
            }
        }

        if (editingTask) {
            neuralScheduler.updateTask(editingTask.id, form);
        } else {
            neuralScheduler.addTask(form);
        }
        setForm(EMPTY_FORM);
        setEditingTask(null);
        setView('tasks');
        refreshData();
    };

    const handleEdit = (task: ScheduledTask) => {
        setForm({
            name: task.name,
            prompt: task.prompt,
            scheduleType: task.scheduleType,
            schedule: task.schedule,
            channel: task.channel,
            mode: task.mode,
            enabled: task.enabled,
            maxExecutionsPerDay: task.maxExecutionsPerDay,
        });
        setEditingTask(task);
        setView('create');
    };

    const handleDelete = (id: string) => {
        neuralScheduler.deleteTask(id);
        refreshData();
    };

    const handleToggle = (id: string) => {
        neuralScheduler.toggleTask(id);
        refreshData();
    };

    const handleRunNow = async (id: string) => {
        setRunningTaskId(id);
        try {
            await neuralScheduler.runTaskNow(id);
        } finally {
            setRunningTaskId(null);
            refreshData();
        }
    };

    const handleExport = () => neuralScheduler.exportTasks();

    const handleImport = async () => {
        const result = await neuralScheduler.importTasks();
        if (result) {
            refreshData();
        }
    };

    const handleClearLogs = () => {
        neuralScheduler.clearLogs();
        refreshData();
    };

    const activeCount = tasks.filter(t => t.enabled).length;
    const nextTask = neuralScheduler.getNextExecution();

    return (
        <div className="space-y-6">
            {/* Status Bar + Actions */}
            <div className="flex items-center justify-between">
                <p className="text-[10px] text-cyan-500/60 font-bold uppercase tracking-widest">
                    {activeCount > 0 ? (activeCount === 1 ? t('scheduler.states.active_task_one') : t('scheduler.states.active_tasks', { count: activeCount })) : t('scheduler.states.no_active')}
                    {nextTask && ` · ${t('scheduler.states.next', { time: formatRelativeTime(nextTask.nextRunAt) })}`}
                </p>
                <div className="flex items-center gap-2">
                </div>
            </div>

            {/* Sub-navigation */}
            <div className="flex gap-2 bg-black/30 p-1.5 rounded-xl border border-transparent">
                {([
                    { id: 'tasks' as const, label: t('scheduler.actions.tasks'), icon: 'list' },
                    { id: 'create' as const, label: editingTask ? t('scheduler.actions.edit') : t('scheduler.actions.new_task'), icon: 'plus' },
                    { id: 'logs' as const, label: t('scheduler.actions.history'), icon: 'history' },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            if (tab.id === 'create' && view !== 'create') {
                                setForm(EMPTY_FORM);
                                setEditingTask(null);
                            }
                            setView(tab.id);
                        }}
                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border border-transparent ${view === tab.id
                            ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                            } hover:border-cyan-500/50`}
                    >
                        <Icon name={tab.icon} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tasks List ──────────────────────────────────────────── */}
            {
                view === 'tasks' && (
                    <div className="space-y-3">
                        {tasks.length === 0 ? (
                            <div className="text-center py-16 space-y-4">
                                <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800/50 border border-white/5 flex items-center justify-center text-slate-600">
                                    <Icon name="calendar-plus" className="text-3xl" />
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold text-sm">{t('scheduler.empty.title')}</p>
                                    <p className="text-slate-600 text-xs mt-1">{t('scheduler.empty.desc')}</p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 pt-2">
                                    {PRESET_TASKS.map(preset => (
                                        <button
                                            key={preset.label}
                                            onClick={() => {
                                                setForm({ ...EMPTY_FORM, ...preset.data });
                                                setView('create');
                                            }}
                                            className="px-4 py-2 bg-cyan-600/10 hover:bg-cyan-600/20 border border-transparent hover:border-cyan-500/50 text-cyan-400 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                                        >
                                            <Icon name={preset.icon} /> {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            tasks.map(task => (
                                <div
                                    key={task.id}
                                    className={`bg-slate-900/60 rounded-2xl p-5 border border-transparent transition-all duration-500 relative overflow-hidden group hover:border-cyan-500/50 ${task.enabled
                                        ? 'opacity-100'
                                        : 'opacity-60 hover:opacity-80'
                                        } hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}
                                >
                                    {/* Active indicator bar */}
                                    {task.enabled && (
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-teal-400 opacity-60" />
                                    )}

                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-black text-white text-sm tracking-tight truncate">{task.name}</span>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${task.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-500 border border-white/5'}`}>
                                                    {task.enabled ? t('scheduler.states.active') : t('scheduler.states.paused')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium line-clamp-2 mb-3">{task.prompt}</p>
                                            <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
                                                <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-400 border border-white/5 flex items-center gap-1.5">
                                                    <Icon name="clock" className="text-cyan-500" /> {getScheduleLabel(task)}
                                                </span>
                                                <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-400 border border-white/5 flex items-center gap-1.5">
                                                    <Icon name={CHANNEL_ICONS[task.channel]} className="text-blue-400" /> {task.channel}
                                                </span>
                                                <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-400 border border-white/5 flex items-center gap-1.5">
                                                    <Icon name={MODE_ICONS[task.mode]} className="text-purple-400" /> {task.mode}
                                                </span>
                                                {task.lastRunAt && (
                                                    <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-400 border border-white/5 flex items-center gap-1.5">
                                                        <Icon name="check" className="text-emerald-500" /> {t('scheduler.headers.last_run')}: {formatRelativeTime(task.lastRunAt)}
                                                    </span>
                                                )}
                                                {task.nextRunAt && (
                                                    <span className="px-2 py-1 bg-slate-800 rounded-lg text-cyan-400 border border-cyan-500/10 flex items-center gap-1.5">
                                                        <Icon name="arrow-right" className="text-cyan-500" /> {t('scheduler.headers.next_run')}: {formatRelativeTime(task.nextRunAt)}
                                                    </span>
                                                )}
                                                <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-500 border border-white/5 flex items-center gap-1.5">
                                                    <Icon name="chart-bar" /> {t('scheduler.states.runs', { count: task.totalExecutions })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => handleToggle(task.id)}
                                                className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center border border-transparent ${task.enabled
                                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60'
                                                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:border-white/20'
                                                    }`}
                                                title={task.enabled ? t('scheduler.actions.pause') : t('scheduler.actions.enable')}
                                            >
                                                <Icon name={task.enabled ? 'pause' : 'play'} />
                                            </button>
                                            <button
                                                onClick={() => handleRunNow(task.id)}
                                                disabled={runningTaskId === task.id}
                                                className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center justify-center disabled:opacity-50"
                                                title={t('scheduler.actions.run')}
                                            >
                                                <Icon name={runningTaskId === task.id ? 'spinner fa-spin' : 'rocket'} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(task)}
                                                className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center"
                                                title={t('scheduler.actions.edit')}
                                            >
                                                <Icon name="pen" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="w-9 h-9 rounded-xl bg-red-950/30 text-red-400 border border-red-900/30 hover:bg-red-900/40 transition-all flex items-center justify-center"
                                                title={t('scheduler.actions.delete')}
                                            >
                                                <Icon name="trash" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )
            }

            {/* ── Create / Edit Form ─────────────────────────────────── */}
            {
                view === 'create' && (
                    <div className="space-y-5">
                        {/* Presets Row */}
                        {!editingTask && (
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.presets')}</label>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {PRESET_TASKS.map(preset => (
                                        <button
                                            key={preset.label}
                                            onClick={() => setForm({ ...EMPTY_FORM, ...preset.data })}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-transparent hover:border-white/20 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                                        >
                                            <Icon name={preset.icon} className="text-cyan-400" /> {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.name')}</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder={t('scheduler.fields.name_placeholder')}
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            />
                        </div>

                        {/* Prompt */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.prompt')}</label>
                            <textarea
                                value={form.prompt}
                                onChange={e => setForm({ ...form, prompt: e.target.value })}
                                placeholder={t('scheduler.fields.prompt_placeholder')}
                                rows={4}
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none custom-scrollbar"
                            />
                        </div>

                        {/* Schedule Type + Value */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.schedule_type')}</label>
                                <div className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5 shrink-0">
                                    {([
                                        { id: 'interval' as const, label: t('scheduler.fields.interval'), icon: 'redo' },
                                        { id: 'cron' as const, label: 'Cron', icon: 'terminal' },
                                        { id: 'once' as const, label: t('common.custom'), icon: 'clock' },
                                    ]).map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                const defaultSchedule = opt.id === 'interval' ? '30' : opt.id === 'cron' ? '0 8 * * *' : new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
                                                setForm({ ...form, scheduleType: opt.id, schedule: defaultSchedule });
                                            }}
                                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${form.scheduleType === opt.id
                                                ? 'bg-cyan-600/90 text-white shadow-lg ring-1 ring-white/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Icon name={opt.icon} /> {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 px-4 py-3.5 bg-black/20 border border-white/5 rounded-xl grow flex items-center">
                                    {form.scheduleType === 'interval' && (
                                        <p className="text-[10.5px] text-slate-400 font-medium leading-relaxed">
                                            <strong className="text-cyan-400 font-bold uppercase tracking-widest block mb-1">{t('scheduler.type_desc.interval_title', 'Intervalo')}:</strong> 
                                            {t('scheduler.type_desc.interval_desc', 'Configura la tarea para que se repita continuamente cada cierto número de minutos. Ideal para comprobaciones y monitoreo recurrente.')}
                                        </p>
                                    )}
                                    {form.scheduleType === 'cron' && (
                                        <div className="flex flex-col justify-center gap-1.5 w-full">
                                            <p className="text-[10px] text-slate-400 font-medium leading-tight mb-0.5">
                                                <strong className="text-cyan-400 font-bold uppercase tracking-widest text-[10.5px] mr-1.5">{t('scheduler.type_desc.cron_title', 'Programación Cron')}:</strong> 
                                                {t('scheduler.type_desc.cron_desc', 'Formato de 5 parámetros de tiempo:')}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-x-2 gap-y-1.5 text-[10px] text-slate-500 font-mono leading-tight pl-1 mt-1 max-w-full">
                                                <div className="truncate pr-1"><span className="text-cyan-500 mr-1">•</span><strong className="text-slate-300 uppercase tracking-widest">{t('scheduler.cron_builder.min_label', 'Minuto')}:</strong> <span className="opacity-80 ml-1">{t('scheduler.cron_builder.min_desc', '¿En qué minuto?')}</span></div>
                                                <div className="truncate pr-1"><span className="text-cyan-500 mr-1">•</span><strong className="text-slate-300 uppercase tracking-widest">{t('scheduler.cron_builder.hor_label', 'Hora')}:</strong> <span className="opacity-80 ml-1">{t('scheduler.cron_builder.hor_desc', '¿hora del día?')}</span></div>
                                                <div className="truncate pr-1"><span className="text-cyan-500 mr-1">•</span><strong className="text-slate-300 uppercase tracking-widest">{t('scheduler.cron_builder.day_label', 'Día (Mes)')}:</strong> <span className="opacity-80 ml-1">{t('scheduler.cron_builder.day_desc', '¿Qué día del mes?')}</span></div>
                                                <div className="truncate pr-1"><span className="text-cyan-500 mr-1">•</span><strong className="text-slate-300 uppercase tracking-widest">{t('scheduler.cron_builder.month_label', 'Mes')}:</strong> <span className="opacity-80 ml-1">{t('scheduler.cron_builder.month_desc', '¿En qué mes?')}</span></div>
                                                <div className="col-span-1 sm:col-span-2 truncate"><span className="text-cyan-500 mr-1">•</span><strong className="text-slate-300 uppercase tracking-widest">{t('scheduler.cron_builder.weekday_label', 'Día (Sem)')}:</strong> <span className="opacity-80 ml-1">{t('scheduler.cron_builder.weekday_desc', '¿En qué día de la semana?')}</span></div>
                                            </div>
                                        </div>
                                    )}
                                    {form.scheduleType === 'once' && (
                                        <p className="text-[10.5px] text-slate-400 font-medium leading-relaxed">
                                            <strong className="text-cyan-400 font-bold uppercase tracking-widest block mb-1">{t('scheduler.type_desc.once_title', 'Una Sola Vez')}:</strong> 
                                            {t('scheduler.type_desc.once_desc', 'Configura la tarea para que se ejecute una única vez en un instante temporal exacto (Fecha/Hora particular). No se repetirá posteriormente.')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col h-full">
                                {form.scheduleType === 'cron' ? (
                                    <CronBuilder value={form.schedule} onChange={v => setForm({ ...form, schedule: v })} t={t} />
                                ) : (
                                    <>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">
                                            {form.scheduleType === 'interval' ? t('scheduler.fields.interval_label') : t('scheduler.fields.run_at_label')}
                                        </label>
                                        {form.scheduleType === 'once' ? (
                                            <div className="relative w-full group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Icon name="calendar-alt" className="text-cyan-500/50 group-focus-within:text-cyan-400 transition-colors text-sm" />
                                                </div>
                                                <input
                                                    type="datetime-local"
                                                    value={form.schedule}
                                                    onChange={e => setForm({ ...form, schedule: e.target.value })}
                                                    title="Select date and time for one-time execution"
                                                    style={{ colorScheme: 'dark' }}
                                                    className="w-full bg-black/40 border border-white/5 rounded-lg py-3.5 pl-11 pr-4 text-slate-200 text-[13px] font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 focus:shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:bg-black/60 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center w-full bg-black/40 border border-white/5 rounded-lg hover:bg-black/60 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.15)] transition-all">
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, schedule: Math.max(1, parseInt(f.schedule || '30') - 1).toString() })) }}
                                                    className="h-[50px] w-14 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded-l-lg transition-colors border-r border-white/5 shrink-0"
                                                    title={t('common.decrease', 'Disminuir')}
                                                    aria-label="Disminuir intervalo"
                                                >
                                                    <Icon name="minus" className="text-xs" />
                                                </button>
                                                <div className="flex-1 flex flex-col items-center justify-center relative py-1">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={form.schedule}
                                                        placeholder="30"
                                                        aria-label="Intervalo de tiempo en minutos"
                                                        title="Intervalo en minutos"
                                                        onChange={e => setForm({ ...form, schedule: e.target.value })}
                                                        className="w-full bg-transparent text-center text-[16px] font-black text-cyan-300 font-mono focus:outline-none placeholder-slate-600/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pt-0.5"
                                                    />
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">{t('scheduler.type_desc.minutes', 'Minutos')}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, schedule: (parseInt(f.schedule || '30') + 1).toString() })) }}
                                                    className="h-[50px] w-14 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded-r-lg transition-colors border-l border-white/5 shrink-0"
                                                    title={t('common.increase', 'Aumentar')}
                                                    aria-label="Aumentar intervalo"
                                                >
                                                    <Icon name="plus" className="text-xs" />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Channel + Mode */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.output_channel')}</label>
                                <div className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                    {([
                                        { id: 'telegram' as TaskChannel, label: 'Telegram', icon: 'paper-plane' },
                                        { id: 'ui' as TaskChannel, label: 'UI', icon: 'desktop' },
                                        { id: 'both' as TaskChannel, label: 'Both', icon: 'globe' },
                                    ]).map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setForm({ ...form, channel: opt.id })}
                                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${form.channel === opt.id
                                                ? 'bg-blue-600/90 text-white shadow-lg ring-1 ring-white/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Icon name={opt.icon} /> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.execution_mode')}</label>
                                <div className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                    {([
                                        { id: 'chat' as TaskMode, label: 'Chat', icon: 'comments' },
                                        { id: 'agent' as TaskMode, label: 'Agent', icon: 'bolt' },
                                    ]).map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setForm({ ...form, mode: opt.id })}
                                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${form.mode === opt.id
                                                ? 'bg-purple-600/90 text-white shadow-lg ring-1 ring-white/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Icon name={opt.icon} /> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Rate Limit */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('scheduler.fields.limit_label')}</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={form.maxExecutionsPerDay}
                                onChange={e => setForm({ ...form, maxExecutionsPerDay: Math.max(0, parseInt(e.target.value) || 0) })}
                                title={t('scheduler.fields.limit_hint')}
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            />
                        </div>

                        {/* Submit */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleCreate}
                                disabled={!form.name.trim() || !form.prompt.trim()}
                                className="flex-1 py-3.5 bg-gradient-to-br from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2 border border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Icon name={editingTask ? 'check' : 'plus'} /> {editingTask ? t('scheduler.save_changes') : t('scheduler.create_task')}
                            </button>
                            {editingTask && (
                                <button
                                    onClick={() => { setEditingTask(null); setForm(EMPTY_FORM); setView('tasks'); }}
                                    className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-white/5"
                                >
                                    {t('common.cancel')}
                                </button>
                            )}
                        </div>
                    </div>
                )
            }

            {/* ── Execution Logs ──────────────────────────────────────── */}
            {
                view === 'logs' && (
                    <div className="space-y-3">
                        {logs.length > 0 && (
                            <div className="flex justify-end">
                                <button
                                    onClick={handleClearLogs}
                                    className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                >
                                    <Icon name="trash" /> {t('scheduler.actions.clear_all')}
                                </button>
                            </div>
                        )}

                        {logs.length === 0 ? (
                            <div className="text-center py-16 space-y-3">
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center text-slate-600">
                                    <Icon name="history" className="text-2xl" />
                                </div>
                                <p className="text-slate-500 font-bold text-sm">{t('scheduler.empty.history_title')}</p>
                                <p className="text-slate-600 text-xs">{t('scheduler.empty.history_desc')}</p>
                            </div>
                        ) : (
                            logs.map((log, idx) => (
                                <div
                                    key={`${log.taskId}-${log.timestamp}-${idx}`}
                                    className={`bg-slate-900/40 rounded-xl p-4 border transition-all ${log.status === 'success'
                                        ? 'border-emerald-500/10'
                                        : log.status === 'error'
                                            ? 'border-red-500/10'
                                            : 'border-amber-500/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Icon
                                                name={log.status === 'success' ? 'check-circle' : log.status === 'error' ? 'times-circle' : 'forward'}
                                                className={log.status === 'success' ? 'text-emerald-400' : log.status === 'error' ? 'text-red-400' : 'text-amber-400'}
                                            />
                                            <span className="font-bold text-white text-xs">{log.taskName}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {new Date(log.timestamp).toLocaleString()}
                                            {log.durationMs && ` · ${(log.durationMs / 1000).toFixed(1)}s`}
                                        </span>
                                    </div>
                                    {log.response && (
                                        <p className="text-xs text-slate-400 line-clamp-3 bg-black/20 rounded-lg p-3 border border-white/5">{log.response}</p>
                                    )}
                                    {log.error && (
                                        <p className="text-xs text-red-400 bg-red-950/20 rounded-lg p-3 border border-red-900/20">{log.error}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )
            }
        </div >
    );
};
