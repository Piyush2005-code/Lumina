import { resolveExecutionPolicy } from "../config/toolPolicies.js";

import type { CallToolResult, Tool as MCPToolDefinition } from "@modelcontextprotocol/sdk/types.js";
import type { MCPServerConnection } from "./MCPServerConnection.js";
import type { Tool, ToolCallResult, ToolContentBlock, ToolParameterSchema } from "../tools/Tool.js";

/**
 * Bridges the MCP world (server + raw tool definition) to the app's internal
 * Tool interface, so the registry never has to know a tool came from MCP.
 *
 * This is also where a tool acquires its execution policy: MCP's own
 * readOnly/destructive annotations are read first, then the local policy table
 * gets the final word.
 */
export class MCPToolAdapter {

    /** Adapts every tool a connected server advertised. */
    static adaptAll(connection: MCPServerConnection): Tool[] {
        return connection.getTools().map(definition => MCPToolAdapter.adapt(connection, definition));
    }

    static adapt(connection: MCPServerConnection, definition: MCPToolDefinition): Tool {

        const name = qualifiedName(connection.id, definition.name);

        const annotations = definition.annotations as
            { readOnlyHint?: boolean; destructiveHint?: boolean } | undefined;

        return {
            name,
            description: definition.description ?? "",
            parameters: definition.inputSchema as ToolParameterSchema,
            source: {
                kind: "mcp",
                serverId: connection.id,
                serverLabel: connection.label,
                serverToolName: definition.name,
            },
            executionPolicy: resolveExecutionPolicy(name, {
                readOnlyHint: annotations?.readOnlyHint,
                destructiveHint: annotations?.destructiveHint,
            }),

            async execute(args: Record<string, unknown>): Promise<ToolCallResult> {
                const result = await connection.callTool(definition.name, args);
                return toToolCallResult(result);
            },
        };
    }
}

/** Namespaced so identically-named tools from different servers can coexist. */
function qualifiedName(serverId: string, toolName: string): string {
    return `${serverId}__${toolName}`;
}

function toToolCallResult(result: CallToolResult): ToolCallResult {
    const content: ToolContentBlock[] = result.content.map(block => {
        if (block.type === "text") {
            return { type: "text", text: block.text };
        }
        return { type: "json", json: block };
    });

    return {
        content,
        ...(result.isError !== undefined ? { isError: result.isError } : {}),
    };
}
