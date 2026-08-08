import type { Tool } from "./Tool.js";

export interface ToolPolicyContext {
    tool: Tool;
    args: Record<string, unknown>;
}

export type PolicyOutcome = "allow" | "require_approval" | "deny";

export interface ToolPolicyDecision {
    outcome: PolicyOutcome;
    reason: string;
}

/** A single rule. Return `undefined` to abstain and let later rules decide. */
export type ToolPolicyRule = (ctx: ToolPolicyContext) => ToolPolicyDecision | undefined;

/**
 * The gate every tool call passes through before execution.
 *
 * Rules run in order and the first decision wins, so ordering is the policy:
 * malformed calls are rejected before anything asks a human to approve them,
 * and the approval requirement is checked before the default allow.
 */
export class ToolPolicy {

    private rules: ToolPolicyRule[] = [];

    addRule(rule: ToolPolicyRule): this {
        this.rules.push(rule);
        return this;
    }

    evaluate(ctx: ToolPolicyContext): ToolPolicyDecision {
        for (const rule of this.rules) {
            const decision = rule(ctx);
            if (decision) {
                return decision;
            }
        }
        return { outcome: "allow", reason: "no rule objected" };
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
            outcome: "deny",
            reason: `Missing required argument(s): ${missing.join(", ")}`,
        };
    }

    return undefined;
};

/** Routes anything classified as side-effecting to a human. */
export const approvalRule: ToolPolicyRule = ({ tool }) => {

    if (tool.executionPolicy === "APPROVAL_REQUIRED") {
        return {
            outcome: "require_approval",
            reason: `${tool.name} has side effects outside Lumina and needs explicit authorisation`,
        };
    }

    return undefined;
};

export const defaultToolPolicy = new ToolPolicy()
    .addRule(requiredArgsRule)
    .addRule(approvalRule);
