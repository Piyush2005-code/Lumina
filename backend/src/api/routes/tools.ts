import { Router } from "express";

import { toolRegistry } from "../../tools/ToolRegistry.js";

/**
 * GET /tools
 *
 * Every tool discovered from connected MCP servers, with the execution policy
 * the runtime will apply to it. Useful for verifying discovery, and for showing
 * the user up front which capabilities will stop and ask before acting.
 */

const router = Router();

router.get("/", (_req, res) => {
    const tools = toolRegistry.list().map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        executionPolicy: tool.executionPolicy,
        server: tool.source.kind === "mcp" ? tool.source.serverLabel : "native",
        serverId: tool.source.kind === "mcp" ? tool.source.serverId : null,
    }));

    res.json({
        tools,
        counts: {
            total: tools.length,
            readOnly: tools.filter(tool => tool.executionPolicy === "READ_ONLY").length,
            approvalRequired: tools.filter(tool => tool.executionPolicy === "APPROVAL_REQUIRED").length,
        },
    });
});

export default router;
