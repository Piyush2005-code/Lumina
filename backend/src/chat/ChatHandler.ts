import { randomUUID } from "node:crypto";

import { ProviderFactory } from "../providers/ProviderFactory.js";
import { toolRegistry } from "../tools/ToolRegistry.js";
import { ToolRouter } from "../tools/ToolRouter.js";
import { ToolExecutor } from "../tools/ToolExecutor.js";
import { defaultToolPolicy } from "../tools/ToolPolicy.js";
import { createLogger, preview, startTimer } from "../utils/logger.js";

import type { ChatMessage, ChatRequest, ChatResponse } from "../types/Chat.js";
import type { ToolCallResult } from "../tools/Tool.js";

/** Hard cap on tool-call round trips per request, so a looping agent can't run forever. */
const MAX_TOOL_ITERATIONS = 8;

const log = createLogger("chat");

export class ChatHandler {

    private readonly toolExecutor = new ToolExecutor(new ToolRouter(toolRegistry), defaultToolPolicy);

    async handle(request: ChatRequest): Promise<ChatResponse> {

        // Every line of one request shares this id, so interleaved requests stay untangleable.
        const requestLog = log.child(randomUUID().slice(0, 8));
        const totalTimer = startTimer();

        const provider = ProviderFactory.get(request.provider);
        const model = request.model ?? provider.defaultModel;

        const tools = toolRegistry.list().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Record<string, unknown>,
        }));

        const messages: ChatMessage[] = [
            ...(request.history ?? []),
            { role: "user", content: request.message },
        ];

        requestLog.info("request received", {
            provider: provider.name,
            model,
            history: request.history?.length ?? 0,
            tools: tools.length,
            message: preview(request.message),
        });
        requestLog.debug("tools offered", { names: tools.map(tool => tool.name).join(",") });

        let toolCallCount = 0;

        for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {

            requestLog.info("→ provider.generate", { iteration, messages: messages.length });

            const turnTimer = startTimer();
            let result;

            try {
                result = await provider.generate(messages, model, tools);
            } catch (error) {
                requestLog.fail("provider.generate threw", error, { iteration, ms: turnTimer() });
                throw error;
            }

            requestLog.info("← provider.generate", {
                iteration,
                ms: turnTimer(),
                type: result.type,
                chars: result.content.length,
                toolCalls: result.type === "tool_calls" ? result.toolCalls.length : 0,
            });

            if (result.type === "final") {
                requestLog.info("request complete", {
                    ms: totalTimer(),
                    iterations: iteration,
                    toolCalls: toolCallCount,
                    chars: result.content.length,
                });
                return { response: result.content, provider: provider.name, model };
            }

            messages.push({
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
            });

            for (const call of result.toolCalls) {

                toolCallCount++;

                requestLog.info("→ tool", { name: call.name, args: preview(call.arguments) });

                const toolTimer = startTimer();
                const toolResult = await this.toolExecutor.execute(call.name, call.arguments);
                const content = stringifyToolResult(toolResult);

                if (toolResult.isError) {
                    requestLog.warn("← tool failed", { name: call.name, ms: toolTimer(), error: preview(content) });
                } else {
                    requestLog.info("← tool ok", { name: call.name, ms: toolTimer(), chars: content.length });
                }

                requestLog.debug("tool result", { name: call.name, result: preview(content, 500) });

                messages.push({
                    role: "tool",
                    toolCallId: call.id,
                    toolName: call.name,
                    content,
                });

            }

        }

        requestLog.error("iteration cap hit", { ms: totalTimer(), max: MAX_TOOL_ITERATIONS, toolCalls: toolCallCount });

        throw new Error(`Exceeded ${MAX_TOOL_ITERATIONS} tool-calling iterations without a final response`);

    }

}

function stringifyToolResult(result: ToolCallResult): string {
    return result.content
        .map(block => (block.type === "text" ? block.text : JSON.stringify(block.json)))
        .join("\n");
}
