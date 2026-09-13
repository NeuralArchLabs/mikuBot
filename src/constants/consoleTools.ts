import type { ToolDefinition } from '../types';

const logParameters = {
    stdoutCursor: { type: 'number', description: 'Read stdout starting at the previous stdoutCursor. Omit for the latest output.' },
    stderrCursor: { type: 'number', description: 'Read stderr starting at the previous stderrCursor. Omit for the latest output.' },
    maxOutputChars: { type: 'number', description: 'Maximum characters per output stream. Truncation and cursors are reported.' }
};

export const CONSOLE_TOOLS: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'run_console',
            description: 'Execute in this session’s project, or its configured workspace when no project is attached. Always inspect returned cwd. The request success and data.success (process outcome) are separate; stderr alone is not failure. Monitor with manage_task. Existing command approval rules apply.',
            parameters: { type: 'object', properties: {
                command: { type: 'string', description: 'Shell command, or executable path when shell:false. Commands are not rewritten.' },
                args: { type: 'string', description: 'Shell argument text for shell:true. Do not use this together with argv or shell:false.' },
                shell: { type: 'boolean', description: 'Default true. Use true with args (shell text), or false with argv (direct executable and exact exit code).' },
                argv: { type: 'array', items: { type: 'string' }, description: 'Exact argument array for shell:false. Use this instead of args; no shell expansion or added quotes.' },
                cwd: { type: 'string', description: 'Defaults to session @WORKSPACE. Relative paths and @WORKSPACE resolve inside that project; other authorized absolute paths/prefixes are supported.' },
                wait_ms: { type: 'number', description: 'Pause this tool response for up to 0–30000 ms while the child runs. If it finishes during the window, return its terminal result; otherwise return running. This does not change timeout_ms.' },
                waitMs: { type: 'number', description: 'Legacy camelCase alias for wait_ms. Prefer wait_ms.' },
                WaitMsBeforeAsync: { type: 'number', description: 'Legacy alias for wait_ms. Prefer wait_ms.' },
                timeout_ms: { type: 'number', description: 'Execution deadline in ms, default 30000, maximum 600000; applies in background too.' },
                commandId: { type: 'string', description: 'Optional unique process ID; duplicates are rejected. Usually omit.' }
            }, required: ['command'] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'manage_task',
            description: 'Monitor or terminate console processes owned by this session. status reads immediately; wait deliberately pauses the response; list discovers retained processes; terminate cancels the process tree. If wait_ms is supplied without action, it is treated as wait. Check data.success, exitCode and status. Terminal reads acknowledge the completion notification.',
            parameters: { type: 'object', properties: {
                action: { type: 'string', enum: ['status', 'wait', 'list', 'terminate'], description: 'Default status.' },
                commandId: { type: 'string', description: 'ID from run_console. Required except for list.' },
                wait_ms: { type: 'number', description: 'For action wait/terminate, pause this response for up to 0–30000 ms; return a terminal snapshot if the process finishes, otherwise running. Does not change execution timeout.' },
                waitMs: { type: 'number', description: 'Legacy camelCase alias for wait_ms. Prefer wait_ms.' },
                ...logParameters
            }, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_console_status',
            description: 'Compatibility alias of manage_task action:status. Returns the same process outcome, effective cwd, duration and logs. Prefer manage_task for monitoring.',
            parameters: { type: 'object', properties: {
                commandId: { type: 'string', description: 'The process ID returned by run_console.' },
                ...logParameters
            }, required: ['commandId'] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'project_status',
            description: 'Inspect this session’s effective workspace before building: cwd, project identity, top-level structure, package.json scripts and dependency presence. Read-only evidence; does not install dependencies or assert build success.',
            parameters: { type: 'object', properties: {
                cwd: { type: 'string', description: 'Optional directory to inspect, resolved exactly as run_console. Defaults to session @WORKSPACE.' }
            }, required: [] }
        }
    }
];
