import { ToolNotFoundError } from "./ToolRouter.js";
import { approvalStore } from "../approvals/ApprovalStore.js";
import { createLogger } from "../utils/logger.js";

import type { ToolCallResult } from "./Tool.js";
import type { ToolRouter } from "./ToolRouter.js";
import type { ToolPolicy } from "./ToolPolicy.js";

const log = createLogger("tool");

export type ToolExecutionOutcome =
    | { status: "executed"; result: ToolCallResult; ms: number }
    | { status: "requires_approval"; reason: string }
    | { status: "denied"; reason: string };

export interface ExecuteOptions {
    /**
     * An approval the caller believes authorises this call. It is verified against
     * the stored record — the id alone proves nothing.
     */
    approvalId?: string | undefined;
}

/**
 * Runs a named tool call end-to-end: resolve → policy → (authorise) → execute.
 *
 * The executor is the only place that can invoke a tool, and it refuses to run a
 * side-effecting one without an approval it has itself verified. That is what
 * makes approval an enforcement point rather than a suggestion: even a caller
 * that skipped the UI entirely cannot get past this method.
 */
export class ToolExecutor {

    constructor(
        private readonly router: ToolRouter,
        private readonly policy: ToolPolicy,
    ) {}

    async execute(
        name: string,
        args: Record<string, unknown>,
        options: ExecuteOptions = {},
    ): Promise<ToolExecutionOutcome> {

        let tool;

        try {
            tool = this.router.resolve(name);
        } catch (error) {
            if (error instanceof ToolNotFoundError) {
                return { status: "denied", reason: error.message };
            }
            throw error;
        }

        const decision = this.policy.evaluate({ tool, args });

        if (decision.outcome === "deny") {
            log.warn("tool call denied", { tool: name, reason: decision.reason });
            return { status: "denied", reason: decision.reason };
        }

        if (decision.outcome === "require_approval") {

            if (options.approvalId === undefined) {
                return { status: "requires_approval", reason: decision.reason };
            }

            const verified = approvalStore.consume(options.approvalId, name, args);

            if (!verified.ok) {
                log.warn("approval rejected at execution", { tool: name, reason: verified.reason });
                return { status: "denied", reason: verified.reason };
            }

            log.info("approved tool executing", { tool: name, approval: options.approvalId });
        }

        const started = performance.now();

        try {
            const result = await tool.execute(args);
            return { status: "executed", result, ms: performance.now() - started };
        } catch (error) {
            return {
                status: "executed",
                ms: performance.now() - started,
                result: {
                    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                    isError: true,
                },
            };
        }
    }
}
