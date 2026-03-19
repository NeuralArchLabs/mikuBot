/**
 * Scheduler Types
 * Interfaces for scheduled tasks and execution logs
 */

/** Task Schedule Type */
export type TaskScheduleType = 'interval' | 'cron' | 'once';

/** Task Channel */
export type TaskChannel = 'telegram' | 'ui' | 'both';

/** Task Mode */
export type TaskMode = 'chat' | 'agent';

/** Scheduled Task */
export interface ScheduledTask {
    id: string;
    name: string;
    prompt: string;
    scheduleType: TaskScheduleType;
    /** For 'interval': minutes between executions. For 'cron': cron expression. For 'once': ISO timestamp. */
    schedule: string;
    channel: TaskChannel;
    mode: TaskMode;
    enabled: boolean;
    /** Max executions per day (0 = unlimited) */
    maxExecutionsPerDay: number;
    /** Timestamps */
    createdAt: number;
    lastRunAt: number | null;
    nextRunAt: number | null;
    /** Execution counters */
    totalExecutions: number;
    executionsToday: number;
    lastExecutionDay: string | null; // YYYY-MM-DD
}

/** Task Execution Log Status */
export type TaskExecutionStatus = 'success' | 'error' | 'skipped';

/** Task Execution Log */
export interface TaskExecutionLog {
    taskId: string;
    taskName: string;
    timestamp: number;
    status: TaskExecutionStatus;
    response?: string;
    error?: string;
    durationMs?: number;
}
