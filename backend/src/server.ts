import app from "./app.js";
import { env } from "./config/env.js";
import { mcpServerConfigs } from "./config/mcpServers.js";
import { MCPServerRegistry } from "./mcp/MCPServerRegistry.js";
import { MCPToolAdapter } from "./mcp/MCPToolAdapter.js";
import { toolRegistry } from "./tools/ToolRegistry.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("server");

app.listen(env.PORT, () => {
    log.info("🚀 Lumina backend listening", { port: env.PORT, logLevel: env.LOG_LEVEL ?? "info" });
});

const mcpRegistry = new MCPServerRegistry(mcpServerConfigs);

mcpRegistry.connectAll().then(() => {

    for (const connection of mcpRegistry.getConnected()) {
        const tools = MCPToolAdapter.adaptAll(connection);
        toolRegistry.registerMany(tools);
        log.info("🔧 registered tools", { server: connection.id, count: tools.length });
    }

    log.info("tool registry ready", {
        tools: toolRegistry.list().length,
        servers: mcpRegistry.getConnected().length,
    });

    // Tools the model can never call are invisible until you look, so name them once at startup.
    log.debug("registered tool names", { names: toolRegistry.list().map(tool => tool.name).join(",") });

});
