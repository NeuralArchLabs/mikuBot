/**
 * Tool Types
 * Interfaces for tool definitions, calls, and results
 */

/** Tool Parameter Schema */
export interface ToolParameter {
    type: string;
    description?: string;
    enum?: string[];
    default?: any;
    items?: ToolParameter; // For recursive array definitions
    properties?: Record<string, ToolParameter>; // For nested object definitions
}

/** Tool Definition */
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, ToolParameter>;
            required: string[];
        };
    };
}

/** Tool Call */
export interface ToolCall {
    id?: string;
    function: {
        name: string;
        arguments: Record<string, any>;
    };
}

/** Tool Result */
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

/** Pending Tool Approval */
export interface PendingToolApproval {
    toolCall: ToolCall;
    resolve: (result: { approved: boolean, feedback?: string }) => void;
}
