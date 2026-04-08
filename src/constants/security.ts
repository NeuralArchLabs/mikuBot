/**
 * Security Constants
 * Console command whitelist and blocked patterns
 */

/**
 * Whitelist of allowed console binaries.
 * Anything NOT on this list will be rejected before execution.
 */
export const CONSOLE_ALLOWED_COMMANDS = [
    'git', 'node', 'npm', 'npx', 'ls', 'dir', 'cat', 'type',
    'echo', 'mkdir', 'cd', 'pwd', 'grep', 'find', 'head', 'tail',
    'wc', 'tree', 'tsc', 'python', 'pip', 'curl', 'wget', 'gh',
    'sqlite3', 'awk', 'sed', 'perl', 'jq', 'ping',
];

/**
 * Patterns that should NEVER appear in command arguments.
 * These block shell injection via metacharacters and path traversal.
 */
export const CONSOLE_BLOCKED_PATTERNS: RegExp[] = [
    /&&/,           // command chaining
    /\|\|/,         // OR chaining
    /\|/,           // pipe
    /;/,            // semicolon chaining
    /`/,            // backtick execution
    /\$\(/,         // subshell
    />\s*\//,       // redirect to root
    /rm\s+(-[rRf]|--)/,  // recursive/force delete
    /del\s+\//,     // Windows delete with root path
    /\.\.\//,       // path traversal
    /\.\.\\/,       // Windows path traversal
    /%[a-zA-Z_]+%/, // environment variables leakage (Windows)
    /\$[a-zA-Z_]+/,  // environment variables leakage (Linux/Unix)
    /[A-Z]:\\/i,     // absolute Windows paths in arguments
];
