import app from "./app.js";
import { env } from "./config/env.js";
import { registerProviders } from "./config/providers.js";
import { getDatabase } from "./db/Database.js";
import { mcpRegistry } from "./mcp/registry.js";
import { MCPToolAdapter } from "./mcp/MCPToolAdapter.js";
import { toolRegistry } from "./tools/ToolRegistry.js";
import { providerRegistry } from "./providers/ProviderRegistry.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("server");

/**
 * Boot order matters:
 *   1. database   — every store below assumes its tables exist
 *   2. providers  — the registry must be populated before anything routes
 *   3. http       — start listening early so /health can report "starting"
 *   4. mcp        — slowest step; servers connect in parallel and failures are non-fatal
 */
async function main(): Promise<void> {

    getDatabase();

    registerProviders();

    const configured = providerRegistry.configured();

    if (configured.length === 0) {
        log.warn("no providers configured — set at least one API key", {
            registered: providerRegistry.ids().join(","),
        });
    }

    // Loopback only. Lumina holds the user's API keys and can run shell commands;
    // it has no business being reachable from the network.
    const server = app.listen(env.PORT, "127.0.0.1", () => {
        log.info("Lumina backend listening", {
            port: env.PORT,
            providers: configured.join(",") || "none",
            logLevel: env.LOG_LEVEL ?? "info",
        });
    });

    await mcpRegistry.connectAll();

    for (const connection of mcpRegistry.getConnected()) {
        const tools = MCPToolAdapter.adaptAll(connection);
        toolRegistry.registerMany(tools);
        log.info("registered tools", { server: connection.id, count: tools.length });
    }

    log.info("tool registry ready", {
        tools: toolRegistry.list().length,
        approvalRequired: toolRegistry.withPolicy("APPROVAL_REQUIRED").length,
        servers: mcpRegistry.getConnected().length,
    });

    log.debug("registered tool names", { names: toolRegistry.list().map(tool => tool.name).join(",") });

    const shutdown = (signal: string) => {
        log.info("shutting down", { signal });
        server.close();
        void mcpRegistry.disconnectAll().finally(() => process.exit(0));
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
    log.fail("failed to start", error);
    process.exit(1);
});
