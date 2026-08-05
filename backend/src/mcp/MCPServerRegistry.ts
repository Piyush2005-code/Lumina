import { MCPServerConnection } from "./MCPServerConnection.js";

import type { MCPServerConfig } from "./MCPServerConnection.js";

/**
 * Owns every configured MCP server connection. This is where the app
 * discovers what tools exist "in the wild" before handing them to the
 * ToolRegistry.
 */
export class MCPServerRegistry {

    private readonly connections = new Map<string, MCPServerConnection>();

    constructor(configs: MCPServerConfig[]) {
        for (const config of configs) {
            this.connections.set(config.id, new MCPServerConnection(config));
        }
    }

    /** Connects every configured server, logging (not throwing on) failures individually. */
    async connectAll(): Promise<void> {
        await Promise.all(
            this.list().map(async connection => {
                try {
                    await connection.connect();
                } catch (error) {
                    console.error(
                        `[MCP] Failed to connect to server "${connection.id}":`,
                        error instanceof Error ? error.message : error
                    );
                }
            })
        );
    }

    async disconnectAll(): Promise<void> {
        await Promise.all(this.list().map(connection => connection.disconnect()));
    }

    get(id: string): MCPServerConnection | undefined {
        return this.connections.get(id);
    }

    list(): MCPServerConnection[] {
        return [...this.connections.values()];
    }

    getConnected(): MCPServerConnection[] {
        return this.list().filter(connection => connection.getStatus() === "connected");
    }

}
