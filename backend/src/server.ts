import app from "./app.js";
import { env } from "./config/env.js";
import { mcpServerConfigs } from "./config/mcpServers.js";
import { MCPServerRegistry } from "./mcp/MCPServerRegistry.js";
import { MCPToolAdapter } from "./mcp/MCPToolAdapter.js";
import { toolRegistry } from "./tools/ToolRegistry.js";

app.listen(env.PORT, () => {
    console.log(`🚀 Lumina Backend listening on port ${env.PORT}`);
});

const mcpRegistry = new MCPServerRegistry(mcpServerConfigs);

mcpRegistry.connectAll().then(() => {
    for (const connection of mcpRegistry.getConnected()) {
        toolRegistry.registerMany(MCPToolAdapter.adaptAll(connection));
    }

    console.log(`🔧 Discovered ${toolRegistry.list().length} tool(s) from ${mcpRegistry.getConnected().length} MCP server(s).`);
});