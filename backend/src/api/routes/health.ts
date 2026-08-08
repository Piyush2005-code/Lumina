import { Router } from "express";

import { providerRegistry } from "../../providers/ProviderRegistry.js";
import { toolRegistry } from "../../tools/ToolRegistry.js";
import { mcpRegistry } from "../../mcp/registry.js";

const router = Router();

const startedAt = Date.now();

/**
 * GET /health — enough detail to tell *which* subsystem is down.
 *
 * "ok" here means the process is up; `ready` means it can actually serve a
 * request, which needs at least one configured provider.
 */
router.get("/", (_req, res) => {

    const configured = providerRegistry.configured();

    res.status(200).json({
        status: "ok",
        service: "Lumina Backend",
        ready: configured.length > 0,
        uptimeMs: Date.now() - startedAt,
        providers: {
            registered: providerRegistry.ids(),
            configured,
        },
        mcp: mcpRegistry.list().map(connection => ({
            id: connection.id,
            label: connection.label,
            status: connection.getStatus(),
            tools: connection.getTools().length,
            lastError: connection.getLastError() ?? null,
        })),
        tools: toolRegistry.list().length,
    });
});

export default router;
