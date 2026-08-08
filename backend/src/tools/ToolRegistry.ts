import type { ExecutionPolicy, Tool } from "./Tool.js";

/**
 * Central lookup table of every tool currently available to agents,
 * regardless of where it came from (MCP server, native handler, ...).
 */
export class ToolRegistry {

    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    registerMany(tools: Tool[]): void {
        for (const tool of tools) {
            this.register(tool);
        }
    }

    /** Drops every tool sourced from a given MCP server, e.g. on disconnect. */
    unregisterServer(serverId: string): void {
        for (const tool of this.tools.values()) {
            if (tool.source.kind === "mcp" && tool.source.serverId === serverId) {
                this.tools.delete(tool.name);
            }
        }
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    list(): Tool[] {
        return [...this.tools.values()];
    }

    withPolicy(policy: ExecutionPolicy): Tool[] {
        return this.list().filter(tool => tool.executionPolicy === policy);
    }
}

export const toolRegistry = new ToolRegistry();
