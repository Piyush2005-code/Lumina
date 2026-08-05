import { Router } from "express";

import { toolRegistry } from "../../tools/ToolRegistry.js";

/**
 * GET /tools
 *
 * Lists every tool currently discovered from connected MCP servers
 * (plus any native tools registered later). Mainly useful for verifying
 * MCP discovery is wired up correctly.
 */

const router = Router();

router.get("/", (_req, res) => {
    const tools = toolRegistry.list().map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        source: tool.source,
    }));

    res.json({ tools });
});

export default router;
