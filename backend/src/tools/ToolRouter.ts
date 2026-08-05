import type { Tool } from "./Tool.js";
import type { ToolRegistry } from "./ToolRegistry.js";

export class ToolNotFoundError extends Error {
    constructor(name: string) {
        super(`No tool registered under the name "${name}"`);
        this.name = "ToolNotFoundError";
    }
}

/**
 * Resolves a tool call requested by name (as an agent/provider would send it)
 * to the concrete Tool that should handle it.
 */
export class ToolRouter {

    constructor(private readonly registry: ToolRegistry) {}

    resolve(name: string): Tool {
        const tool = this.registry.get(name);

        if (!tool) {
            throw new ToolNotFoundError(name);
        }

        return tool;
    }

}
