import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult, Tool as MCPToolDefinition } from "@modelcontextprotocol/sdk/types.js";

/**
 * Thin wrapper around the MCP SDK's Client: owns the protocol handshake
 * and exposes just the calls the rest of the app needs (list/call tools).
 * One instance per connected server.
 */
export class MCPClient {

    private readonly client: Client;
    private connected = false;

    constructor(clientName: string, clientVersion = "0.1.0") {
        this.client = new Client({ name: clientName, version: clientVersion });
    }

    async connect(transport: Transport): Promise<void> {
        await this.client.connect(transport);
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) {
            return;
        }
        await this.client.close();
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async listTools(): Promise<MCPToolDefinition[]> {
        const result = await this.client.listTools();
        return result.tools;
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        return this.client.callTool({ name, arguments: args }) as Promise<CallToolResult>;
    }

}
