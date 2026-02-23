/**
 * ──────────────────────────────────────────────────────────────────────
 *  Neural Scheduler — Scheduled Task Engine for MikuCentral
 * ──────────────────────────────────────────────────────────────────────
 * 
 *  Manages scheduled/cronjob-like tasks that the AI agent can execute
 *  proactively. Tasks are persisted, configurable, and exportable.
 * 
 *  Architecture:
 *   - Tick loop runs every 30s in the renderer process
 *   - Tasks are evaluated against their schedule (interval/cron/once)
 *   - Execution is queued (FIFO) to avoid conflicts with user chat
 *   - Results are routed to configured channel (Telegram/UI/both)
 *   - Full persistence via Electron IPC or localStorage fallback
 * ──────────────────────────────────────────────────────────────────────
 */

import { ScheduledTask, TaskExecutionLog } from '../../types';

const electron = (window as any).electron;
const STORAGE_KEY = 'mikucentral_scheduler';
const LOGS_STORAGE_KEY = 'mikucentral_scheduler_logs';
const TICK_INTERVAL_MS = 30_000; // Check every 30 seconds
const MAX_LOGS = 100; // Keep last 100 execution logs

// ── Cron Parser (Minimal, no dependencies) ───────────────────────────

/**
 * Parses a simple cron expression (minute hour dayOfMonth month dayOfWeek)
 * and checks if the current time matches.
 * Supports: numbers, asterisk, lists (1,2,3), ranges (1-5), steps (asterisk/5)
 */
function matchesCron(cronExpr: string, date: Date): boolean {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const checks = [
        { value: date.getMinutes(), field: parts[0], max: 59 },
        { value: date.getHours(), field: parts[1], max: 23 },
        { value: date.getDate(), field: parts[2], max: 31 },
        { value: date.getMonth() + 1, field: parts[3], max: 12 },
        { value: date.getDay(), field: parts[4], max: 6 },  // 0=Sunday
    ];

    return checks.every(({ value, field, max }) => matchesField(value, field, max));
}

function matchesField(value: number, field: string, max: number): boolean {
    if (field === '*') return true;

    // Handle lists: "1,3,5"
    if (field.includes(',')) {
        return field.split(',').some(part => matchesField(value, part.trim(), max));
    }

    // Handle steps: "*/5" or "1-10/2"
    if (field.includes('/')) {
        const [range, stepStr] = field.split('/');
        const step = parseInt(stepStr, 10);
        if (isNaN(step) || step <= 0) return false;

        if (range === '*') {
            return value % step === 0;
        }

        if (range.includes('-')) {
            const [start, end] = range.split('-').map(Number);
            return value >= start && value <= end && (value - start) % step === 0;
        }

        return false;
    }

    // Handle ranges: "1-5"
    if (field.includes('-')) {
        const [start, end] = field.split('-').map(Number);
        return value >= start && value <= end;
    }

    // Plain number
    return parseInt(field, 10) === value;
}

/**
 * Calculates the next run time for a task based on its schedule type.
 */
function calculateNextRun(task: ScheduledTask, fromTime: number = Date.now()): number | null {
    switch (task.scheduleType) {
        case 'interval': {
            const intervalMs = parseInt(task.schedule, 10) * 60_000; // minutes to ms
            if (isNaN(intervalMs) || intervalMs <= 0) return null;
            return fromTime + intervalMs;
        }
        case 'cron': {
            // Find next matching minute within the next 24 hours
            const now = new Date(fromTime);
            for (let i = 1; i <= 1440; i++) { // Check up to 24 hours ahead
                const candidate = new Date(now.getTime() + i * 60_000);
                candidate.setSeconds(0, 0);
                if (matchesCron(task.schedule, candidate)) {
                    return candidate.getTime();
                }
            }
            return null; // No match in next 24h (shouldn't happen with valid cron)
        }
        case 'once': {
            const target = new Date(task.schedule).getTime();
            return target > fromTime ? target : null;
        }
        default:
            return null;
    }
}

// ── Scheduler Service ────────────────────────────────────────────────

type TaskExecutor = (prompt: string, mode: 'chat' | 'agent', isScheduled: boolean) => Promise<string>;
type TelegramNotifier = (text: string) => void;

class NeuralScheduler {
    private tasks: ScheduledTask[] = [];
    private logs: TaskExecutionLog[] = [];
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private isExecuting = false;
    private executionQueue: ScheduledTask[] = [];
    private userIsActive = false; // True when user is chatting
    private onTasksChanged: (() => void) | null = null;
    private onLogsChanged: (() => void) | null = null;
    private executor: TaskExecutor | null = null;
    private telegramNotifier: TelegramNotifier | null = null;
    private onUiMessage: ((taskName: string, response: string) => void) | null = null;

    // ── Initialization ───────────────────────────────────────────────

    async init(
        executor: TaskExecutor,
        telegramNotifier: TelegramNotifier,
        onUiMessage: (taskName: string, response: string) => void,
        onTasksChanged: () => void,
        onLogsChanged: () => void,
    ): Promise<void> {
        this.executor = executor;
        this.telegramNotifier = telegramNotifier;
        this.onUiMessage = onUiMessage;
        this.onTasksChanged = onTasksChanged;
        this.onLogsChanged = onLogsChanged;

        await this.loadTasks();
        await this.loadLogs();

        // Recalculate all nextRunAt on startup
        const now = Date.now();
        for (const task of this.tasks) {
            if (task.enabled && (task.nextRunAt === null || task.nextRunAt < now)) {
                task.nextRunAt = calculateNextRun(task, now);
            }
        }
        await this.saveTasks();

        this.startTickLoop();
        console.log(`[NeuralScheduler] Initialized with ${this.tasks.length} tasks.`);
    }

    destroy(): void {
        this.stopTickLoop();
        this.executor = null;
        this.telegramNotifier = null;
        this.onUiMessage = null;
        console.log('[NeuralScheduler] Destroyed.');
    }

    // ── Tick Loop ────────────────────────────────────────────────────

    private startTickLoop(): void {
        if (this.tickTimer) return;
        this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
        // Also run immediately
        this.tick();
    }

    private stopTickLoop(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
    }

    private async tick(): Promise<void> {
        if (this.isExecuting || this.userIsActive) return;

        const now = Date.now();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        for (const task of this.tasks) {
            if (!task.enabled) continue;
            if (task.nextRunAt === null) continue;
            if (task.nextRunAt > now) continue;

            // Reset daily counter if new day
            if (task.lastExecutionDay !== today) {
                task.executionsToday = 0;
                task.lastExecutionDay = today;
            }

            // Rate limit check
            if (task.maxExecutionsPerDay > 0 && task.executionsToday >= task.maxExecutionsPerDay) {
                console.log(`[NeuralScheduler] Task "${task.name}" hit daily limit (${task.maxExecutionsPerDay}).`);
                task.nextRunAt = calculateNextRun(task, now);
                continue;
            }

            // Enqueue for execution
            this.executionQueue.push(task);
        }

        // Process queue (one at a time)
        await this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.isExecuting || this.executionQueue.length === 0) return;

        this.isExecuting = true;

        while (this.executionQueue.length > 0 && !this.userIsActive) {
            const task = this.executionQueue.shift()!;
            await this.executeTask(task);
        }

        this.isExecuting = false;
    }

    // ── Task Execution ───────────────────────────────────────────────

    private async executeTask(task: ScheduledTask): Promise<void> {
        if (!this.executor) return;

        const startTime = Date.now();
        const log: TaskExecutionLog = {
            taskId: task.id,
            taskName: task.name,
            timestamp: startTime,
            status: 'success',
        };

        console.log(`[NeuralScheduler] Executing task: "${task.name}"`);

        try {
            const response = await this.executor(task.prompt, task.mode, true);

            log.response = response.slice(0, 500); // Truncate for storage
            log.durationMs = Date.now() - startTime;
            log.status = 'success';

            // Route to configured channel
            if (task.channel === 'telegram' || task.channel === 'both') {
                this.telegramNotifier?.(`🔔 [${task.name}]\n\n${response}`);
            }
            if (task.channel === 'ui' || task.channel === 'both') {
                this.onUiMessage?.(task.name, response);
            }
        } catch (error) {
            log.status = 'error';
            log.error = error instanceof Error ? error.message : String(error);
            log.durationMs = Date.now() - startTime;
            console.error(`[NeuralScheduler] Task "${task.name}" failed:`, error);
        }

        // Update task stats
        task.lastRunAt = startTime;
        task.totalExecutions++;
        task.executionsToday++;

        // Calculate next run
        if (task.scheduleType === 'once') {
            task.enabled = false; // One-shot task, disable after execution
            task.nextRunAt = null;
        } else {
            task.nextRunAt = calculateNextRun(task, Date.now());
        }

        // Persist
        this.addLog(log);
        await this.saveTasks();
    }

    // ── User Activity Lock ───────────────────────────────────────────

    setUserActive(active: boolean): void {
        this.userIsActive = active;
        // When user finishes, process any pending tasks
        if (!active && this.executionQueue.length > 0) {
            this.processQueue();
        }
    }

    // ── CRUD Operations ──────────────────────────────────────────────

    getTasks(): ScheduledTask[] {
        return [...this.tasks];
    }

    getLogs(): TaskExecutionLog[] {
        return [...this.logs];
    }

    addTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'lastRunAt' | 'nextRunAt' | 'totalExecutions' | 'executionsToday' | 'lastExecutionDay'>): ScheduledTask {
        const newTask: ScheduledTask = {
            ...task,
            id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: Date.now(),
            lastRunAt: null,
            nextRunAt: null,
            totalExecutions: 0,
            executionsToday: 0,
            lastExecutionDay: null,
        };

        if (newTask.enabled) {
            newTask.nextRunAt = calculateNextRun(newTask);
        }

        this.tasks.push(newTask);
        this.saveTasks();
        this.onTasksChanged?.();
        console.log(`[NeuralScheduler] Task added: "${newTask.name}" (${newTask.scheduleType}: ${newTask.schedule})`);
        return newTask;
    }

    updateTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
        const idx = this.tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;

        const task = { ...this.tasks[idx], ...updates };

        // Recalculate next run if schedule changed or task was re-enabled
        if (updates.schedule !== undefined || updates.scheduleType !== undefined || updates.enabled !== undefined) {
            if (task.enabled) {
                task.nextRunAt = calculateNextRun(task);
            } else {
                task.nextRunAt = null;
            }
        }

        this.tasks[idx] = task;
        this.saveTasks();
        this.onTasksChanged?.();
        return task;
    }

    deleteTask(id: string): boolean {
        const before = this.tasks.length;
        this.tasks = this.tasks.filter(t => t.id !== id);
        if (this.tasks.length < before) {
            this.saveTasks();
            this.onTasksChanged?.();
            return true;
        }
        return false;
    }

    toggleTask(id: string): ScheduledTask | null {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return null;
        return this.updateTask(id, { enabled: !task.enabled });
    }

    /**
     * Force-run a task NOW, regardless of schedule.
     */
    async runTaskNow(id: string): Promise<void> {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        await this.executeTask(task);
        this.onTasksChanged?.();
    }

    clearLogs(): void {
        this.logs = [];
        this.saveLogs();
        this.onLogsChanged?.();
    }

    // ── Persistence ──────────────────────────────────────────────────

    private async saveTasks(): Promise<void> {
        const data = JSON.stringify(this.tasks, null, 2);

        if (electron?.saveSchedulerTasks) {
            try {
                await electron.saveSchedulerTasks(data);
                return;
            } catch (e) {
                console.error('[NeuralScheduler] Electron save tasks failed:', e);
            }
        }

        // Web Fallback Only
        try {
            localStorage.setItem(STORAGE_KEY, data);
        } catch (e) {
            console.error('[NeuralScheduler] Failed to save tasks to localstorage:', e);
        }
    }

    private async loadTasks(): Promise<void> {
        if (electron?.loadSchedulerTasks) {
            try {
                const result = await electron.loadSchedulerTasks();
                if (result.ok && result.data) {
                    this.tasks = JSON.parse(result.data);
                    return;
                }
            } catch (e) {
                console.error('[NeuralScheduler] Electron load tasks failed:', e);
            }
        }

        // Web Fallback Only
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.tasks = JSON.parse(raw);
            }
        } catch (e) {
            console.error('[NeuralScheduler] Failed to load tasks from localstorage:', e);
        }
    }

    private addLog(log: TaskExecutionLog): void {
        this.logs.unshift(log); // Most recent first
        if (this.logs.length > MAX_LOGS) {
            this.logs = this.logs.slice(0, MAX_LOGS);
        }
        this.saveLogs();
        this.onLogsChanged?.();
    }

    private async saveLogs(): Promise<void> {
        const data = JSON.stringify(this.logs, null, 2);

        if (electron?.saveSchedulerLogs) {
            try {
                await electron.saveSchedulerLogs(data);
                return;
            } catch (e) {
                console.error('[NeuralScheduler] Electron save logs failed:', e);
            }
        }

        // Web Fallback Only
        try {
            localStorage.setItem(LOGS_STORAGE_KEY, data);
        } catch (e) { }
    }

    private async loadLogs(): Promise<void> {
        if (electron?.loadSchedulerLogs) {
            try {
                const result = await electron.loadSchedulerLogs();
                if (result.ok && result.data) {
                    this.logs = JSON.parse(result.data);
                    return;
                }
            } catch (e) {
                console.error('[NeuralScheduler] Electron load logs failed:', e);
            }
        }

        // Web Fallback Only
        try {
            const raw = localStorage.getItem(LOGS_STORAGE_KEY);
            if (raw) this.logs = JSON.parse(raw);
        } catch (e) { }
    }

    // ── Export / Import ───────────────────────────────────────────────

    exportTasks(): void {
        const payload = JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: this.tasks,
            logs: this.logs,
        }, null, 4);

        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `miku-scheduler-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async importTasks(): Promise<{ imported: number; skipped: number } | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';

            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) { resolve(null); return; }

                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);

                    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
                        console.error('[NeuralScheduler] Invalid import file structure');
                        resolve(null);
                        return;
                    }

                    let imported = 0;
                    let skipped = 0;

                    for (const task of parsed.tasks) {
                        // Check for duplicate by name
                        if (this.tasks.some(t => t.name === task.name)) {
                            skipped++;
                            continue;
                        }

                        // Assign new ID and reset runtime stats
                        const newTask: ScheduledTask = {
                            ...task,
                            id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                            lastRunAt: null,
                            nextRunAt: task.enabled ? calculateNextRun(task) : null,
                            totalExecutions: 0,
                            executionsToday: 0,
                            lastExecutionDay: null,
                        };

                        this.tasks.push(newTask);
                        imported++;
                    }

                    // Import logs too (append)
                    if (parsed.logs && Array.isArray(parsed.logs)) {
                        this.logs = [...parsed.logs, ...this.logs].slice(0, MAX_LOGS);
                        this.saveLogs();
                    }

                    await this.saveTasks();
                    this.onTasksChanged?.();
                    this.onLogsChanged?.();

                    resolve({ imported, skipped });
                } catch (e) {
                    console.error('[NeuralScheduler] Import failed:', e);
                    resolve(null);
                }

                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    getActiveCount(): number {
        return this.tasks.filter(t => t.enabled).length;
    }

    getNextExecution(): ScheduledTask | null {
        const enabled = this.tasks
            .filter(t => t.enabled && t.nextRunAt !== null)
            .sort((a, b) => (a.nextRunAt || Infinity) - (b.nextRunAt || Infinity));
        return enabled[0] || null;
    }
}

export const neuralScheduler = new NeuralScheduler();
