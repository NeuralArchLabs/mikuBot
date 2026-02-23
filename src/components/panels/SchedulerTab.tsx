import React, { useState, useEffect, useCallback } from 'react';
import { ScheduledTask, TaskExecutionLog, TaskScheduleType, TaskChannel, TaskMode } from '../../types';
import { neuralScheduler } from '../../services';
import { Icon } from '../common/Common';

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    const diff = timestamp - Date.now();
    if (diff < 0) {
        const ago = Date.now() - timestamp;
        if (ago < 60_000) return 'Just now';
        if (ago < 3_600_000) return `${Math.floor(ago / 60_000)}m ago`;
        if (ago < 86_400_000) return `${Math.floor(ago / 3_600_000)}h ago`;
        return `${Math.floor(ago / 86_400_000)}d ago`;
    }
    if (diff < 60_000) return 'Soon';
    if (diff < 3_600_000) return `In ${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `In ${Math.floor(diff / 3_600_000)}h`;
    return `In ${Math.floor(diff / 86_400_000)}d`;
}

function getScheduleLabel(task: ScheduledTask): string {
    switch (task.scheduleType) {
        case 'interval': return `Every ${task.schedule} min`;
        case 'cron': return `Cron: ${task.schedule}`;
        case 'once': return `Once: ${new Date(task.schedule).toLocaleString()}`;
    }
}

const CHANNEL_ICONS: Record<TaskChannel, string> = {
    telegram: 'paper-plane',
    ui: 'desktop',
    both: 'globe',
};

const MODE_ICONS: Record<TaskMode, string> = {
    chat: 'comments',
    agent: 'bolt',
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

const PRESET_TASKS: { label: string; icon: string; data: Partial<TaskFormData> }[] = [
    {
        label: 'Morning Briefing',
        icon: 'sun',
        data: { name: 'Morning Briefing', prompt: 'Give me a concise briefing of my pending tasks and anything important I should know today.', scheduleType: 'cron', schedule: '0 8 * * *', channel: 'telegram', mode: 'chat' }
    },
    {
        label: 'Periodic Check-in',
        icon: 'heartbeat',
        data: { name: 'Check-In', prompt: 'Review ACTIVE_CONTEXT.md and notify me of any upcoming deadlines or important updates.', scheduleType: 'interval', schedule: '60', channel: 'telegram', mode: 'chat' }
    },
    {
        label: 'Evening Journal',
        icon: 'moon',
        data: { name: 'Evening Journal', prompt: 'Ask me how my day went and help me reflect on accomplishments and tomorrow\'s priorities.', scheduleType: 'cron', schedule: '0 21 * * *', channel: 'telegram', mode: 'chat' }
    },
];

// ── Main Component ───────────────────────────────────────────────────

export const SchedulerTab = ({ onBack }: { onBack?: () => void }) => {
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [logs, setLogs] = useState<TaskExecutionLog[]>([]);
    const [view, setView] = useState<'tasks' | 'logs' | 'create'>('tasks');
    const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
    const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
    const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
    const [tickCounter, setTickCounter] = useState(0);

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

    const handleCreate = () => {
        if (!form.name.trim() || !form.prompt.trim()) return;

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
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-400 hover:text-white transition-all flex items-center justify-center"
                                title="Back to Core System"
                            >
                                <Icon name="arrow-left" />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-900/10">
                            <Icon name="clock" className="text-xl" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 tracking-tight">Neural Scheduler</h3>
                            <p className="text-[10px] text-cyan-500/60 font-bold uppercase tracking-widest">
                                {activeCount > 0 ? `${activeCount} active task${activeCount > 1 ? 's' : ''}` : 'No active tasks'}
                                {nextTask && ` · Next: ${formatRelativeTime(nextTask.nextRunAt)}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleImport}
                            className="h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2"
                            title="Import tasks from JSON file"
                        >
                            <Icon name="download" /> Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2"
                            title="Export all tasks as JSON file"
                        >
                            <Icon name="file-export" /> Export
                        </button>
                    </div>
                </div>

                {/* Sub-navigation */}
                <div className="flex gap-2 bg-black/30 p-1.5 rounded-xl border border-white/5">
                    {([
                        { id: 'tasks' as const, label: 'Tasks', icon: 'list' },
                        { id: 'create' as const, label: editingTask ? 'Edit Task' : 'New Task', icon: 'plus' },
                        { id: 'logs' as const, label: 'History', icon: 'history' },
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
                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${view === tab.id
                                ? 'bg-cyan-600/90 text-white shadow-lg shadow-cyan-900/40 ring-1 ring-white/20'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                        >
                            <Icon name={tab.icon} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tasks List ──────────────────────────────────────────── */}
            {view === 'tasks' && (
                <div className="space-y-3">
                    {tasks.length === 0 ? (
                        <div className="text-center py-16 space-y-4">
                            <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800/50 border border-white/5 flex items-center justify-center text-slate-600">
                                <Icon name="calendar-plus" className="text-3xl" />
                            </div>
                            <div>
                                <p className="text-slate-400 font-bold text-sm">No scheduled tasks yet</p>
                                <p className="text-slate-600 text-xs mt-1">Create a task to get the agent working autonomously</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 pt-2">
                                {PRESET_TASKS.map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={() => {
                                            setForm({ ...EMPTY_FORM, ...preset.data });
                                            setView('create');
                                        }}
                                        className="px-4 py-2 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
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
                                className={`bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border transition-all relative overflow-hidden group ${task.enabled
                                    ? 'border-cyan-500/20 hover:border-cyan-500/40'
                                    : 'border-white/5 opacity-60 hover:opacity-80'
                                    }`}
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
                                                {task.enabled ? 'Active' : 'Paused'}
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
                                                    <Icon name="check" className="text-emerald-500" /> Last: {formatRelativeTime(task.lastRunAt)}
                                                </span>
                                            )}
                                            {task.nextRunAt && (
                                                <span className="px-2 py-1 bg-slate-800 rounded-lg text-cyan-400 border border-cyan-500/10 flex items-center gap-1.5">
                                                    <Icon name="arrow-right" className="text-cyan-500" /> Next: {formatRelativeTime(task.nextRunAt)}
                                                </span>
                                            )}
                                            <span className="px-2 py-1 bg-slate-800 rounded-lg text-slate-500 border border-white/5 flex items-center gap-1.5">
                                                <Icon name="chart-bar" /> {task.totalExecutions} runs
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleToggle(task.id)}
                                            className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center border ${task.enabled
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                : 'bg-slate-800 text-slate-500 border-white/5 hover:bg-slate-700'
                                                }`}
                                            title={task.enabled ? 'Pause task' : 'Enable task'}
                                        >
                                            <Icon name={task.enabled ? 'pause' : 'play'} />
                                        </button>
                                        <button
                                            onClick={() => handleRunNow(task.id)}
                                            disabled={runningTaskId === task.id}
                                            className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center justify-center disabled:opacity-50"
                                            title="Run now"
                                        >
                                            <Icon name={runningTaskId === task.id ? 'spinner fa-spin' : 'rocket'} />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(task)}
                                            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center"
                                            title="Edit task"
                                        >
                                            <Icon name="pen" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(task.id)}
                                            className="w-9 h-9 rounded-xl bg-red-950/30 text-red-400 border border-red-900/30 hover:bg-red-900/40 transition-all flex items-center justify-center"
                                            title="Delete task"
                                        >
                                            <Icon name="trash" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Create / Edit Form ─────────────────────────────────── */}
            {view === 'create' && (
                <div className="space-y-5">
                    {/* Presets Row */}
                    {!editingTask && (
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Quick Presets</label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_TASKS.map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={() => setForm({ ...EMPTY_FORM, ...preset.data })}
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                                    >
                                        <Icon name={preset.icon} className="text-cyan-400" /> {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Task Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g., Morning Briefing"
                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                    </div>

                    {/* Prompt */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Agent Prompt</label>
                        <textarea
                            value={form.prompt}
                            onChange={e => setForm({ ...form, prompt: e.target.value })}
                            placeholder="What should the agent do when this task runs? Be specific..."
                            rows={4}
                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none custom-scrollbar"
                        />
                    </div>

                    {/* Schedule Type + Value */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Schedule Type</label>
                            <div className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                {([
                                    { id: 'interval' as const, label: 'Interval', icon: 'redo' },
                                    { id: 'cron' as const, label: 'Cron', icon: 'terminal' },
                                    { id: 'once' as const, label: 'Once', icon: 'clock' },
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
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">
                                {form.scheduleType === 'interval' ? 'Interval (minutes)' : form.scheduleType === 'cron' ? 'Cron Expression' : 'Run At'}
                            </label>
                            {form.scheduleType === 'once' ? (
                                <input
                                    type="datetime-local"
                                    value={form.schedule}
                                    onChange={e => setForm({ ...form, schedule: e.target.value })}
                                    title="Select date and time for one-time execution"
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={form.schedule}
                                    onChange={e => setForm({ ...form, schedule: e.target.value })}
                                    placeholder={form.scheduleType === 'interval' ? '30' : '0 8 * * *'}
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                />
                            )}
                            {form.scheduleType === 'cron' && (
                                <p className="text-[9px] text-slate-600 font-medium mt-1.5 ml-1">Format: minute hour day month weekday (e.g., 0 8 * * 1-5 = 8am weekdays)</p>
                            )}
                        </div>
                    </div>

                    {/* Channel + Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Output Channel</label>
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
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Execution Mode</label>
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
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Daily Execution Limit (0 = unlimited)</label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.maxExecutionsPerDay}
                            onChange={e => setForm({ ...form, maxExecutionsPerDay: Math.max(0, parseInt(e.target.value) || 0) })}
                            title="Maximum number of times this task can run per day"
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
                            <Icon name={editingTask ? 'check' : 'plus'} /> {editingTask ? 'Save Changes' : 'Create Task'}
                        </button>
                        {editingTask && (
                            <button
                                onClick={() => { setEditingTask(null); setForm(EMPTY_FORM); setView('tasks'); }}
                                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-white/5"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Execution Logs ──────────────────────────────────────── */}
            {view === 'logs' && (
                <div className="space-y-3">
                    {logs.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleClearLogs}
                                className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                            >
                                <Icon name="trash" /> Clear All
                            </button>
                        </div>
                    )}

                    {logs.length === 0 ? (
                        <div className="text-center py-16 space-y-3">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center text-slate-600">
                                <Icon name="history" className="text-2xl" />
                            </div>
                            <p className="text-slate-500 font-bold text-sm">No execution history yet</p>
                            <p className="text-slate-600 text-xs">Logs will appear here after tasks run</p>
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
            )}
        </div>
    );
};
