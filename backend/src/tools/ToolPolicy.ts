import type { Tool } from "./Tool.js";

export interface ToolPolicyContext {
    tool: Tool;
    args: Record<string, unknown>;
}

export interface ToolPolicyDecision {
    allowed: boolean;
    reason?: string;
}

/** A single rule. Return `undefined` to abstain and let later rules decide. */
export type ToolPolicyRule = (ctx: ToolPolicyContext) => ToolPolicyDecision | undefined;

/**
 * Permission layer every tool call passes through before execution.
 * Rules are evaluated in order; the first one to return a decision wins.
 * With no matching rule, the call is allowed by default.
 */
export class ToolPolicy {

    private rules: ToolPolicyRule[] = [];

    addRule(rule: ToolPolicyRule): void {
        this.rules.push(rule);
    }

    evaluate(ctx: ToolPolicyContext): ToolPolicyDecision {
        for (const rule of this.rules) {
            const decision = rule(ctx);
            if (decision) {
                return decision;
            }
        }

        return { allowed: true };
    }

}

/**
 * Rejects calls missing an argument the tool's own schema marks as required,
 * so malformed agent-generated tool calls fail fast with a clear reason
 * instead of reaching the underlying MCP server.
 */
export const requiredArgsRule: ToolPolicyRule = ({ tool, args }) => {
    const required = tool.parameters.required ?? [];

    const missing = required.filter(key => !(key in args));

    if (missing.length > 0) {
        return {
            allowed: false,
            reason: `Missing required argument(s): ${missing.join(", ")}`,
        };
    }

    return undefined;
};

export const defaultToolPolicy = new ToolPolicy();
defaultToolPolicy.addRule(requiredArgsRule);
