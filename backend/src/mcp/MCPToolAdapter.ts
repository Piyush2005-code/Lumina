import type { CallToolResult, Tool as MCPToolDefinition } from "@modelcontextprotocol/sdk/types.js";
import type { MCPServerConnection } from "./MCPServerConnection.js";
import type { Tool, ToolCallResult, ToolContentBlock, ToolParameterSchema } from "../tools/Tool.js";

/**
 * Bridges the MCP world (server + raw tool definition) to the app's
 * internal Tool interface, so ToolRegistry never has to know a tool
 * came from MCP at all.
 */
export class MCPToolAdapter {

    /** Adapts every tool a connected server advertised. */
    static adaptAll(connection: MCPServerConnection): Tool[] {
        return connection.getTools().map(definition => MCPToolAdapter.adapt(connection, definition));
    }

    static adapt(connection: MCPServerConnection, definition: MCPToolDefinition): Tool {
        return {
            name: qualifiedName(connection.id, definition.name),
            description: definition.description ?? "",
            parameters: definition.inputSchema as ToolParameterSchema,
            source: { kind: "mcp", serverId: connection.id, serverToolName: definition.name },

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
