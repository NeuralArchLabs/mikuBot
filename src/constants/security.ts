/**
 * Security Constants
 * Console command whitelist and blocked patterns
 */

/**
 * Whitelist of allowed console binaries for CHAT MODE (Lax).
 */
export const LAX_CONSOLE_ALLOWED_COMMANDS = [
    'git', 'node', 'npm', 'npx', 'ls', 'dir', 'cat', 'type',
    'echo', 'mkdir', 'cd', 'pwd', 'grep', 'find', 'head', 'tail',
    'wc', 'tree', 'tsc', 'python', 'python3', 'pip', 'pip3', 'curl', 'wget', 'gh',
    'sqlite3', 'awk', 'sed', 'perl', 'jq', 'ping', 'tasklist',
    'taskkill', 'systeminfo', 'whoami', 'netstat', 'ipconfig',
    'ssh', 'scp', 'rsync', 'findstr', 'powershell', 'cmd',
    'vite', 'next', 'react-native', 'expo', 'flutter', 'dart',
    'go', 'rustc', 'cargo', 'java', 'javac', 'mvn', 'gradle',
    'docker', 'kubectl', 'date', 'time', 'hostname', 'ver',
    'tracert', 'rmdir', 'nodejs'
];

/**
 * Whitelist of allowed console binaries (Legacy/Strict).
 * Anything NOT on this list will be rejected in strict environments.
 */
export const CONSOLE_ALLOWED_COMMANDS = [
    'git', 'node', 'npm', 'npx', 'ls', 'dir', 'cat', 'type',
    'echo', 'mkdir', 'cd', 'pwd', 'grep', 'find', 'head', 'tail',
    'wc', 'tree', 'tsc', 'python', 'pip', 'curl', 'wget', 'gh',
    'sqlite3', 'awk', 'sed', 'perl', 'jq', 'ping',
];

/**
 * Patterns that should NEVER appear in command arguments in CHAT MODE (Lax).
 */
export const LAX_CONSOLE_BLOCKED_PATTERNS: RegExp[] = [
    /rm\s+(-[rRf]|--)/,  // recursive/force delete
    /del\s+\//,     // Windows delete with root path
    /\.\.\//,       // path traversal
    /\.\.\\/,       // Windows path traversal
];

/**
 * Commands that trigger a HIGH RISK warning and mandatory approval.
 */
export const HIGH_RISK_COMMANDS = [
    'rm', 'del', 'rd', 'format', 'mkfs', 'fdisk', 'dd', 
    'chmod', 'chown', 'mv', 'ren', 'wget', 'curl', 'ssh',
    'taskkill', 'kill', 'shutdown', 'reboot', 'rmdir'
];

/**
 * Patterns that should NEVER appear in command arguments (Legacy/Strict).
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
