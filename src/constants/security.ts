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
    'taskkill', 'systeminfo', 'whoami', 'netstat', 'ipconfig', 'arp', 'nslookup',
    'ssh', 'scp', 'rsync', 'findstr', 'powershell', 'cmd',
    'vite', 'next', 'react-native', 'expo', 'flutter', 'dart',
    'go', 'rustc', 'cargo', 'java', 'javac', 'mvn', 'gradle',
    'docker', 'kubectl', 'date', 'time', 'hostname', 'ver',
    'tracert', 'rmdir', 'nodejs', 'where', 'path', 'ifconfig', 'traceroute'
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
 * Console commands that are considered "Safe" or "Non-destructive"
 * and can be executed without authorization in auto-mode (even in Chat).
 */
export const SAFE_CONSOLE_COMMANDS = [
    'ls', 'dir', 'pwd', 'whoami', 'hostname', 'ver', 'date', 'time',
    'systeminfo', 'type', 'cat', 'echo', 'grep', 'wc', 'head', 'tail', 'tree',
    'findstr', 'ipconfig', 'ifconfig', 'arp', 'ping', 'netstat', 'tracert',
    'traceroute', 'nslookup', 'tasklist', 'where', 'path', 'tasklist'
];

/**
 * Mapping of binaries to their "Safe" subcommands.
 * If the command matches the binary and the arguments start with one of these,
 * it is considered safe for auto-approval.
 */
export const SAFE_COMMAND_SUBCOMMANDS: Record<string, string[]> = {
    'npm': ['install', 'i', 'test', 't', 'run', 'start', 'init', 'list', 'ls', 'view', 'search', 'help', 'doctor', '--version', '-v'],
    'pip': ['install', 'list', 'show', 'search', 'freeze', 'check', 'help', '--version'],
    'git': ['status', 'branch', 'log', 'remote', 'diff', 'show', 'fetch', 'pull', '--version', 'rev-parse'],
    'python': ['-m venv', '-m pip', '-v', '--version'],
    'python3': ['-m venv', '-m pip', '-v', '--version'],
    'node': ['-v', '--version'],
    'cargo': ['build', 'test', 'run', 'check', 'init', 'new', 'list', 'search', 'help', '--version'],
    'go': ['build', 'test', 'run', 'get', 'mod init', 'mod tidy', 'version', 'help'],
    'tsc': ['-v', '--version', '--init'],
    'gh': ['status', 'auth status', 'repo view', 'issue list', 'pr list', '--version']
};

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
