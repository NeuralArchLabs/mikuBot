/**
 * Constants Barrel Export
 * Maintains backward compatibility by re-exporting all constants
 */

// Provider configurations
export * from './providers';

// Security constants
export * from './security';

// Database constants
export * from './database';

// Tool definitions
export * from './tools';

// File-related constants
export * from './files';

// Default configuration
export * from './config';

// Re-export legacy for backward compatibility
export { PROVIDERS } from './providers';
export { 
    CONSOLE_ALLOWED_COMMANDS, 
    CONSOLE_BLOCKED_PATTERNS,
    LAX_CONSOLE_ALLOWED_COMMANDS,
    LAX_CONSOLE_BLOCKED_PATTERNS,
    HIGH_RISK_COMMANDS
} from './security';
export { DB_NAME, STORE_NAME } from './database';
export { AGENT_TOOLS, MAX_TOOL_ITERATIONS } from './tools';
export { PROTECTED_CORE_FILES } from './files';
export { DEFAULT_FILES, DEFAULT_CONFIG } from './config';
