/**
 * JSON-Schema-shaped description of a tool's arguments, as advertised by
 * whatever produced the tool (an MCP server today, a native handler later).
 */
export interface ToolParameterSchema {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
}

export type ToolContentBlock =
    | { type: "text"; text: string }
    | { type: "json"; json: unknown };

export interface ToolCallResult {
    content: ToolContentBlock[];
    isError?: boolean;
}

/** Where a tool came from — used for routing calls back to their owner. */
export type ToolSource =
    | { kind: "mcp"; serverId: string; serverToolName: string }
    | { kind: "native" };

export interface Tool {
    /** Globally-unique name the tool is registered and invoked under. */
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolParameterSchema;
    readonly source: ToolSource;

    execute(args: Record<string, unknown>): Promise<ToolCallResult>;
}
