import { ToolNotFoundError } from "./ToolRouter.js";

import type { ToolCallResult } from "./Tool.js";
import type { ToolRouter } from "./ToolRouter.js";
import type { ToolPolicy } from "./ToolPolicy.js";

/**
 * Executes a named tool call end-to-end: resolve -> policy check -> run,
 * always returning a ToolCallResult rather than throwing, so callers
 * (e.g. a chat loop feeding results back to a model) never need a try/catch.
 */
export class ToolExecutor {

    constructor(
        private readonly router: ToolRouter,
        private readonly policy: ToolPolicy,
    ) {}

    async execute(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {

        let tool;

        try {
            tool = this.router.resolve(name);
        } catch (error) {
            if (error instanceof ToolNotFoundError) {
                return errorResult(error.message);
            }
            throw error;
        }

        const decision = this.policy.evaluate({ tool, args });

        if (!decision.allowed) {
            return errorResult(`Tool call blocked: ${decision.reason ?? "not allowed"}`);
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            return errorResult(error instanceof Error ? error.message : String(error));
        }

    }

}

function errorResult(message: string): ToolCallResult {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
