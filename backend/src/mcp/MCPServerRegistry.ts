import { MCPServerConnection } from "./MCPServerConnection.js";
import { createLogger, startTimer } from "../utils/logger.js";

import type { MCPServerConfig } from "./MCPServerConnection.js";

const log = createLogger("mcp");

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

        const timer = startTimer();

        log.info("connecting all servers", { configured: this.connections.size });

        await Promise.all(
            this.list().map(async connection => {
                try {
                    await connection.connect();
                } catch {
                    // Already logged with detail by the connection itself; one bad server
                    // must not stop the others from coming up.
                }
            })
        );

        log.info("connect pass done", {
            ms: timer(),
            connected: this.getConnected().length,
            of: this.connections.size,
        });

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
