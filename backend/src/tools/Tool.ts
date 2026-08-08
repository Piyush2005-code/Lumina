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

/**
 * Whether running this tool is a decision a human has to make.
 *
 * READ_ONLY tools observe; the agent runs them freely. APPROVAL_REQUIRED tools
 * change something outside Lumina — send mail, write files, execute shell — and
 * the runtime refuses to execute one without a matching approval record. The
 * classification lives on the tool, so the runtime never has to recognise
 * individual tool names.
 */
export type ExecutionPolicy = "READ_ONLY" | "APPROVAL_REQUIRED";

/** Where a tool came from — used for routing calls back to their owner. */
export type ToolSource =
    | { kind: "mcp"; serverId: string; serverLabel: string; serverToolName: string }
    | { kind: "native" };

export interface Tool {
    /** Globally-unique name the tool is registered and invoked under. */
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolParameterSchema;
    readonly source: ToolSource;
    readonly executionPolicy: ExecutionPolicy;

    execute(args: Record<string, unknown>): Promise<ToolCallResult>;
}

/** Flattens a tool result into the single string a model expects back. */
export function stringifyToolResult(result: ToolCallResult): string {
    return result.content
        .map(block => (block.type === "text" ? block.text : JSON.stringify(block.json)))
        .join("\n");
}
