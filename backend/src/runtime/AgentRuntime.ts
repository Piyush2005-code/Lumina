import { randomUUID } from "node:crypto";

import { conversationStore } from "./ConversationStore.js";
import { toolRegistry } from "../tools/ToolRegistry.js";
import { ToolRouter } from "../tools/ToolRouter.js";
import { ToolExecutor } from "../tools/ToolExecutor.js";
import { defaultToolPolicy } from "../tools/ToolPolicy.js";
import { stringifyToolResult } from "../tools/Tool.js";
import { toolExecutionStore, toInvocationView } from "../tools/ToolExecutionStore.js";
import { approvalStore, toApprovalView } from "../approvals/ApprovalStore.js";
import { scheduler } from "../scheduler/Scheduler.js";
import { inferenceRouter } from "../scheduler/InferenceRouter.js";
import { MAX_TOOL_ITERATIONS } from "../config/constants.js";
import { createLogger, preview, startTimer } from "../utils/logger.js";

import type { Logger } from "../utils/logger.js";
import type { ToolDefinition } from "../providers/Provider.js";
import type { ToolInvocationView, ChatResponse, CapabilityRequirements, RoutingPreference, FailoverView } from "../types/Chat.js";

const log = createLogger("runtime");

const SYSTEM_PROMPT = `You are Lumina, a locally-running assistant with access to the user's machine through tools.

Guidelines:
- Prefer using a tool over guessing. If a tool can answer the question, call it.
- Some tools change things outside Lumina (sending mail, writing files, running shell commands). Those pause for the user's explicit approval before they run. Propose them normally — the user will be asked.
- If the user declines a tool, do not try to achieve the same effect another way. Acknowledge the decision and offer alternatives.
- Be concise. Report what a tool actually returned rather than what you expected it to return.`;

export interface TurnOptions {
    preference: RoutingPreference;
    preferredProvider?: string | undefined;
    preferredModel?: string | undefined;
    require?: Partial<CapabilityRequirements> | undefined;
}

interface TurnState {
    invocations: ToolInvocationView[];
    failovers: FailoverView[];
    provider: string;
    model: string;
    requirements: CapabilityRequirements;
    rationale: string;
}

/**
 * The agent loop.
 *
 * Everything model-specific has already been abstracted away by the time control
 * arrives here: this class asks the scheduler for a route, asks the router to run
 * it, and asks the executor to run whatever tools come back. It never names a
 * provider and never decides whether a tool is safe.
 *
 * The loop can suspend. When a tool needs human authorisation the turn returns
 * with `awaiting_approval` and the transcript stays in the database until the
 * user decides, at which point `continueTurn` picks it up exactly where it
 * stopped.
 */
export class AgentRuntime {

    private readonly executor = new ToolExecutor(new ToolRouter(toolRegistry), defaultToolPolicy);

    /** Starts a new turn from a user message. */
    async startTurn(conversationId: string, message: string, options: TurnOptions): Promise<ChatResponse> {

        const requestLog = log.child(randomUUID().slice(0, 8));

        /*
         * Settle leftovers BEFORE the new message goes in, not after.
         *
         * A tool result has to sit directly behind the assistant turn that asked
         * for it — every provider rejects a transcript where a user message has
         * been spliced in between. If the previous turn was abandoned mid-approval,
         * its cancellation notes must land while that assistant turn is still last.
         */
        const settled = await this.settleOutstanding(conversationId, requestLog);

        conversationStore.append(conversationId, { role: "user", content: message });

        requestLog.info("turn started", {
            conversation: conversationId,
            preference: options.preference,
            message: preview(message),
        });

        return this.drive(conversationId, options, requestLog, settled);
    }

    /**
     * Resumes a turn that stopped for approval. Settles every decided approval
     * first; if any are still undecided the turn stays suspended.
     */
    async continueTurn(conversationId: string, options: TurnOptions): Promise<ChatResponse> {

        const requestLog = log.child(randomUUID().slice(0, 8));

        requestLog.info("turn resumed", { conversation: conversationId });

        const settled = await this.settleOutstanding(conversationId, requestLog);

        return this.drive(conversationId, options, requestLog, settled);
    }

    private async drive(
        conversationId: string,
        options: TurnOptions,
        requestLog: Logger,
        settled: ToolInvocationView[],
    ): Promise<ChatResponse> {

        const totalTimer = startTimer();

        const state: TurnState = {
            invocations: [],
            failovers: [],
            provider: "none",
            model: "none",
            requirements: { tools: false, vision: false, streaming: false, minContext: 0 },
            rationale: "",
        };

        // Calls settled by the caller (approved and run, or declined and reported)
        // are part of this turn's visible history.
        state.invocations.push(...settled);

        const stillWaiting = approvalStore.pending(conversationId);

        if (stillWaiting.length > 0) {
            return this.suspended(conversationId, state, totalTimer());
        }

        for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {

            const tools = describeTools();
            const messages = [
                { role: "system" as const, content: SYSTEM_PROMPT },
                ...conversationStore.window(conversationId),
            ];

            const plan = scheduler.plan({
                messages,
                toolCount: tools.length,
                preference: options.preference,
                ...(options.preferredProvider !== undefined ? { preferredProvider: options.preferredProvider } : {}),
                ...(options.preferredModel !== undefined ? { preferredModel: options.preferredModel } : {}),
                ...(options.require !== undefined ? { require: options.require } : {}),
            });

            state.requirements = plan.requirements;
            state.rationale = plan.rationale;

            requestLog.info("route planned", {
                iteration,
                eligible: plan.candidates.length,
                excluded: plan.rejected.length,
                chose: plan.candidates[0] ? `${plan.candidates[0].providerId}/${plan.candidates[0].model.id}` : "none",
            });
            requestLog.debug("route rationale", { rationale: plan.rationale });

            const routed = await inferenceRouter.run(
                plan,
                requestLog.name,
                model => ({ model, messages, tools, stream: false }),
                requestLog,
            );

            state.provider = routed.providerId;
            state.model = routed.model;
            state.failovers.push(...routed.failovers);

            const result = routed.response;

            if (result.type === "final") {
                conversationStore.append(conversationId, { role: "assistant", content: result.content });
                requestLog.info("turn complete", { ms: totalTimer(), iterations: iteration, tools: state.invocations.length });
                return {
                    status: "complete",
                    conversationId,
                    response: result.content,
                    provider: state.provider,
                    model: state.model,
                    toolCalls: state.invocations,
                    pendingApprovals: [],
                    routing: {
                        preference: options.preference,
                        requirements: state.requirements,
                        rationale: state.rationale,
                        failovers: state.failovers,
                        ms: totalTimer(),
                    },
                };
            }

            conversationStore.append(conversationId, {
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
            });

            let paused = false;

            for (const call of result.toolCalls) {

                const tool = toolRegistry.get(call.name);

                const record = toolExecutionStore.create({
                    conversationId,
                    toolCallId: call.id,
                    toolName: call.name,
                    arguments: call.arguments,
                    // An unknown tool is treated as the dangerous case; the executor
                    // will reject it by name anyway, but the record should not lie.
                    policy: tool?.executionPolicy ?? "APPROVAL_REQUIRED",
                });

                requestLog.info("tool proposed", { name: call.name, policy: record.policy, args: preview(call.arguments) });

                const outcome = await this.executor.execute(call.name, call.arguments);

                if (outcome.status === "requires_approval") {

                    toolExecutionStore.setStatus(record.id, "AWAITING_APPROVAL");

                    approvalStore.create({
                        conversationId,
                        toolExecutionId: record.id,
                        toolName: call.name,
                        arguments: call.arguments,
                        reason: outcome.reason,
                    });

                    paused = true;
                    state.invocations.push(toInvocationView({ ...record, status: "AWAITING_APPROVAL" }));
                    continue;
                }

                if (outcome.status === "denied") {
                    toolExecutionStore.finish(record.id, "DENIED", outcome.reason, true, 0);
                    conversationStore.append(conversationId, {
                        role: "tool",
                        toolCallId: call.id,
                        toolName: call.name,
                        content: `Tool call blocked: ${outcome.reason}`,
                    });
                    state.invocations.push(toInvocationView({
                        ...record, status: "DENIED", result: outcome.reason, isError: true, ms: 0,
                    }));
                    continue;
                }

                const content = stringifyToolResult(outcome.result);
                const isError = outcome.result.isError === true;

                toolExecutionStore.finish(record.id, isError ? "FAILED" : "COMPLETED", content, isError, outcome.ms);

                conversationStore.append(conversationId, {
                    role: "tool",
                    toolCallId: call.id,
                    toolName: call.name,
                    content,
                });

                requestLog.info(isError ? "tool failed" : "tool ok", {
                    name: call.name, ms: Math.round(outcome.ms), chars: content.length,
                });

                state.invocations.push(toInvocationView({
                    ...record,
                    status: isError ? "FAILED" : "COMPLETED",
                    result: content,
                    isError,
                    ms: Math.round(outcome.ms),
                }));
            }

            if (paused) {
                requestLog.info("turn suspended for approval", { ms: totalTimer() });
                return this.suspended(conversationId, state, totalTimer(), options.preference);
            }
        }

        throw new Error(`Exceeded ${MAX_TOOL_ITERATIONS} tool-calling iterations without a final response`);
    }

    /**
     * Executes or abandons every tool call left hanging by a suspended turn.
     * Approved calls run with their approval id; rejected and expired ones are
     * reported back to the model as tool results so it can respond to the refusal.
     */
    private async settleOutstanding(conversationId: string, requestLog: Logger): Promise<ToolInvocationView[]> {

        const outstanding = toolExecutionStore.unresolved(conversationId);
        const views: ToolInvocationView[] = [];

        for (const record of outstanding) {

            if (record.status === "PROPOSED") {
                // Proposed but never executed — a crash between insert and run.
                toolExecutionStore.finish(record.id, "CANCELLED", "Abandoned before execution", true, 0);
                continue;
            }

            const approval = approvalStore.forToolExecution(record.id);

            if (!approval || approval.status === "WAITING_FOR_APPROVAL") {
                continue;
            }

            if (approval.status === "REJECTED" || approval.status === "EXPIRED") {

                const message = approval.status === "REJECTED"
                    ? "The user declined this tool call. Do not attempt it again or work around it."
                    : "This tool call expired before the user responded.";

                toolExecutionStore.finish(record.id, "REJECTED", message, true, 0);

                conversationStore.append(conversationId, {
                    role: "tool",
                    toolCallId: record.toolCallId,
                    toolName: record.toolName,
                    content: message,
                });

                requestLog.info("tool call declined", { name: record.toolName, status: approval.status });

                views.push(toInvocationView({ ...record, status: "REJECTED", result: message, isError: true, ms: 0 }));
                continue;
            }

            if (approval.status === "APPROVED") {

                toolExecutionStore.setStatus(record.id, "EXECUTING");

                // Arguments come from the stored record, never from the client that
                // clicked approve — the two can only ever be the same thing.
                const outcome = await this.executor.execute(record.toolName, record.arguments, {
                    approvalId: approval.id,
                });

                if (outcome.status !== "executed") {
                    const reason = outcome.reason;
                    toolExecutionStore.finish(record.id, "DENIED", reason, true, 0);
                    conversationStore.append(conversationId, {
                        role: "tool",
                        toolCallId: record.toolCallId,
                        toolName: record.toolName,
                        content: `Tool call blocked: ${reason}`,
                    });
                    views.push(toInvocationView({ ...record, status: "DENIED", result: reason, isError: true, ms: 0 }));
                    continue;
                }

                const content = stringifyToolResult(outcome.result);
                const isError = outcome.result.isError === true;

                toolExecutionStore.finish(record.id, isError ? "FAILED" : "COMPLETED", content, isError, outcome.ms);

                conversationStore.append(conversationId, {
                    role: "tool",
                    toolCallId: record.toolCallId,
                    toolName: record.toolName,
                    content,
                });

                requestLog.info("approved tool ran", { name: record.toolName, ms: Math.round(outcome.ms), isError });

                views.push(toInvocationView({
                    ...record,
                    status: isError ? "FAILED" : "COMPLETED",
                    result: content,
                    isError,
                    ms: Math.round(outcome.ms),
                }));
            }
        }

        return views;
    }

    private suspended(
        conversationId: string,
        state: TurnState,
        ms: number,
        preference: RoutingPreference = "balanced",
    ): ChatResponse {

        const pending = approvalStore.pending(conversationId);

        const summary = pending.length === 1 && pending[0]
            ? `I need your approval before running \`${pending[0].toolName}\`.`
            : `I need your approval before running ${pending.length} tool calls.`;

        return {
            status: "awaiting_approval",
            conversationId,
            response: summary,
            provider: state.provider,
            model: state.model,
            toolCalls: state.invocations,
            pendingApprovals: pending.map(toApprovalView),
            routing: {
                preference,
                requirements: state.requirements,
                rationale: state.rationale,
                failovers: state.failovers,
                ms,
            },
        };
    }
}

/** The tool list as offered to a model, with the approval requirement made explicit in prose. */
function describeTools(): ToolDefinition[] {
    return toolRegistry.list().map(tool => ({
        name: tool.name,
        description: tool.executionPolicy === "APPROVAL_REQUIRED"
            ? `${tool.description} (Side-effecting: the user must approve this before it runs.)`
            : tool.description,
        parameters: tool.parameters as Record<string, unknown>,
    }));
}

export const agentRuntime = new AgentRuntime();
