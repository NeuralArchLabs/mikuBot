import type { AppConfig, ToolResult } from '../../../types';

export const CONSOLE_TOOL_NAMES = new Set(['run_console', 'manage_task', 'get_console_status']);

/** IPC success describes the request; data.success describes the child process. */
export function consoleToolResult(result: any): ToolResult {
    if (!result || result.ok !== true) {
        return { success: false, error: result?.error || 'Console request failed.', ...(result ? { data: result } : {}) };
    }
    return { success: true, data: result };
}

/** Match terminal events by process identity, never by the model's tool call ID. */
export function consoleCompletionKey(note: any): string | null {
    if (!note || typeof note !== 'object') return null;
    if (typeof note.eventId === 'string' && note.eventId) return `event:${note.eventId}`;
    const commandId = note.commandId || note.id;
    if (typeof commandId === 'string' && commandId) return `command:${commandId}`;
    return null;
}

export function hasConsoleCompletion(messages: any[], note: any): boolean {
    return messages.some(message => {
        if (message.consoleEventId && message.consoleEventId === note.eventId) return true;
        if (message.role !== 'tool') return false;
        try {
            const result = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
            const data = result?.data || result;
            if (data?.eventId && note.eventId) return data.eventId === note.eventId;
            return (data?.commandId || data?.id) === note.commandId
                && data?.status && data.status !== 'running';
        } catch { return false; }
    });
}

export async function executeConsoleTool(
    name: string, args: Record<string, any>, config: AppConfig, sessionId: string | undefined, bridge: any
): Promise<ToolResult> {
    // The model supplies cwd, but cannot select another session/project by adding arguments.
    const context = { projectId: config.executionContext?.projectId ?? null, sessionId: sessionId ?? null };
    try {
        if (name === 'run_console') {
            if (!bridge?.runConsole) return { success: false, error: 'Console execution requires the Electron desktop app.' };
            const waitOptions = ['wait_ms', 'waitMs', 'WaitMsBeforeAsync']
                .filter(key => args[key] !== undefined && args[key] !== null);
            const waitValues = [...new Set(waitOptions.map(key => args[key]))];
            if (waitValues.length > 1) {
                return { success: false, error: 'Use only one wait option: `wait_ms` (legacy aliases: `waitMs` or `WaitMsBeforeAsync`).' };
            }
            const wait_ms = waitValues[0];
            if (args.argv !== undefined && args.args !== undefined) {
                return { success: false, error: 'Invalid console arguments: use `argv` with `shell:false` or use `args` with `shell:true`; do not combine them.' };
            }
            if (args.argv !== undefined && args.shell !== false) {
                return { success: false, error: 'Invalid console arguments: `argv` is the direct-execution form and requires `shell:false`.' };
            }
            if (args.args !== undefined && args.shell === false) {
                return { success: false, error: 'Invalid console arguments: `args` is shell text and requires `shell:true`; use `argv` with `shell:false` for direct execution.' };
            }
            return consoleToolResult(await bridge.runConsole({
                command: args.command,
                args: args.argv ?? args.args,
                shell: args.shell,
                cwd: args.cwd,
                expectedWorkspacePath: config.folderPaths?.workSpace || undefined,
                // `wait_ms` deliberately keeps this tool call open while the
                // child runs. The backend returns a terminal snapshot when it
                // finishes, or `running` when this observation window expires.
                wait_ms,
                // Preserve the legacy bridge field for older preload versions.
                WaitMsBeforeAsync: wait_ms,
                commandId: args.commandId,
                timeout_ms: args.timeout_ms,
                ...context
            }));
        }
        if (name === 'project_status') {
            if (!bridge?.projectStatus) return { success: false, error: 'Project inspection requires the Electron desktop app.' };
            return consoleToolResult(await bridge.projectStatus({ cwd: args.cwd, expectedWorkspacePath: config.folderPaths?.workSpace || undefined, ...context }));
        }
        const action = name === 'get_console_status'
            ? 'status'
            : (args.action ?? ((args.wait_ms !== undefined || args.waitMs !== undefined) ? 'wait' : 'status'));
        const manage = bridge?.manageTask || (action === 'status' ? bridge?.runConsoleStatus : undefined);
        if (!manage) return { success: false, error: 'Console task management requires the Electron desktop app.' };
        return consoleToolResult(await manage({
            action,
            commandId: args.commandId,
            wait_ms: args.wait_ms ?? args.waitMs,
            stdoutCursor: args.stdoutCursor, stderrCursor: args.stderrCursor,
            maxOutputChars: args.maxOutputChars, ...context
        }));
    } catch (error) {
        return { success: false, error: `Console error: ${error instanceof Error ? error.message : String(error)}` };
    }
}
