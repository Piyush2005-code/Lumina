import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { MCPClient } from "./MCPClient.js";
import { createLogger, startTimer } from "../utils/logger.js";

import type { Logger } from "../utils/logger.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult, Tool as MCPToolDefinition } from "@modelcontextprotocol/sdk/types.js";

export type MCPTransportConfig =
    | { type: "stdio"; command: string; args?: string[]; cwd?: string; env?: Record<string, string> }
    | { type: "http"; url: string };

export interface MCPServerConfig {
    id: string;
    label: string;
    transport: MCPTransportConfig;
}

export type MCPServerStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * One configured MCP server: owns its transport/client, tracks connection
 * state, and caches the tool list the server advertised on connect.
 */
export class MCPServerConnection {

    readonly id: string;
    readonly label: string;

    private readonly client: MCPClient;
    private readonly log: Logger;
    private status: MCPServerStatus = "disconnected";
    private lastError: string | undefined;
    private tools: MCPToolDefinition[] = [];

    constructor(private readonly config: MCPServerConfig) {
        this.id = config.id;
        this.label = config.label;
        this.client = new MCPClient(`lumina-backend:${config.id}`);
        this.log = createLogger(`mcp:${config.id}`);
    }

    getStatus(): MCPServerStatus {
        return this.status;
    }

    getLastError(): string | undefined {
        return this.lastError;
    }

    getTools(): MCPToolDefinition[] {
        return this.tools;
    }

    async connect(): Promise<void> {
        this.status = "connecting";

        const timer = startTimer();

        this.log.info("connecting", { transport: this.config.transport.type });

        try {
            const transport = this.buildTransport();
            await this.client.connect(transport);
            this.tools = await this.client.listTools();
            this.status = "connected";
            this.lastError = undefined;

            this.log.info("connected", { ms: timer(), tools: this.tools.length });
            this.log.debug("tools advertised", { names: this.tools.map(tool => tool.name).join(",") });
        } catch (error) {
            this.status = "error";
            this.lastError = error instanceof Error ? error.message : String(error);
            this.log.fail("connect failed", error, { ms: timer() });
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.client.disconnect();
        this.status = "disconnected";
        this.log.info("disconnected");
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {

        const timer = startTimer();

        try {
            const result = await this.client.callTool(name, args);
            this.log.debug("callTool", { name, ms: timer(), isError: result.isError ?? false });
            return result;
        } catch (error) {
            this.log.fail("callTool threw", error, { name, ms: timer() });
            throw error;
        }

    }

    private buildTransport(): Transport {
        const transport = this.config.transport;

        switch (transport.type) {

            case "stdio":
                return new StdioClientTransport({
                    command: transport.command,
                    ...(transport.args !== undefined ? { args: transport.args } : {}),
                    ...(transport.cwd !== undefined ? { cwd: transport.cwd } : {}),
                    ...(transport.env !== undefined ? { env: transport.env } : {}),
                });

            case "http":
                // StreamableHTTPClientTransport's `sessionId` getter is typed `string | undefined`,
                // which structurally conflicts with Transport's exactOptionalPropertyTypes-checked
                // `sessionId?: string` — an upstream SDK typing quirk, not a real incompatibility.
                return new StreamableHTTPClientTransport(new URL(transport.url)) as Transport;

        }
    }

}
