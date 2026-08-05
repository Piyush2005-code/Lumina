import Groq from "groq-sdk";

import { env } from "../../config/env.js";
import { createLogger, describeError, startTimer } from "../../utils/logger.js";

import type { GenerateResult, Provider, ToolDefinition } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const log = createLogger("groq");

/**
 * Llama models on Groq occasionally emit a malformed tool call (Groq rejects
 * it with code "tool_use_failed" before it ever reaches our code) — it's
 * stochastic, so a same-input retry usually succeeds.
 */
const TOOL_USE_FAILED_RETRIES = 2;

export class GroqProvider implements Provider {

    readonly name = "groq";
    readonly defaultModel = DEFAULT_MODEL;

    private client: Groq;

    constructor() {
        if (!env.GROQ_API_KEY) {
            throw new Error("Missing GROQ_API_KEY");
        }

        this.client = new Groq({
            apiKey: env.GROQ_API_KEY
        });
    }

    async generate(
        messages: ChatMessage[],
        model: string = DEFAULT_MODEL,
        tools: ToolDefinition[] = []
    ): Promise<GenerateResult> {

        const apiTimer = startTimer();

        const completion = await this.withToolUseRetry(() => this.client.chat.completions.create({
            model,
            messages: messages.map(toGroqMessage),
            // Lower temperature makes structured tool-call output more reliable.
            ...(tools.length > 0 ? { tools: tools.map(toGroqTool), temperature: 0 } : {}),
        }));

        const choice = completion.choices[0]?.message;

        log.debug("completion", {
            model,
            ms: apiTimer(),
            finish: completion.choices[0]?.finish_reason,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            // Groq reports its own server-side inference time, which isolates network overhead.
            inferenceMs: completion.usage?.total_time !== undefined ? Math.round(completion.usage.total_time * 1000) : undefined,
        });

        if (choice?.tool_calls && choice.tool_calls.length > 0) {
            return {
                type: "tool_calls",
                content: choice.content ?? "",
                toolCalls: choice.tool_calls.map(call => ({
                    id: call.id,
                    name: call.function.name,
                    arguments: safeParseArguments(call.function.arguments),
                })),
            };
        }

        return { type: "final", content: choice?.content ?? "" };
    }

    private async withToolUseRetry<T>(fn: () => Promise<T>): Promise<T> {
        for (let attempt = 0; ; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt >= TOOL_USE_FAILED_RETRIES || !isToolUseFailedError(error)) {
                    throw error;
                }
                // Each retry is a full extra round trip, so surface it — it explains sudden latency spikes.
                log.warn("malformed tool call, retrying", {
                    attempt: attempt + 1,
                    of: TOOL_USE_FAILED_RETRIES,
                    error: describeError(error),
                });
            }
        }
    }
}

function isToolUseFailedError(error: unknown): boolean {
    return error instanceof Groq.APIError && (error.error as { error?: { code?: string } } | null)?.error?.code === "tool_use_failed";
}

function toGroqMessage(message: ChatMessage): Groq.Chat.ChatCompletionMessageParam {
    switch (message.role) {

        case "user":
            return { role: "user", content: message.content };

        case "assistant":
            if (message.toolCalls && message.toolCalls.length > 0) {
                return {
                    role: "assistant",
                    content: message.content || null,
                    tool_calls: message.toolCalls.map(call => ({
                        id: call.id,
                        type: "function",
                        function: {
                            name: call.name,
                            arguments: JSON.stringify(call.arguments),
                        },
                    })),
                };
            }
            return { role: "assistant", content: message.content };

        case "tool":
            return { role: "tool", tool_call_id: message.toolCallId, content: message.content };

    }
}

function toGroqTool(tool: ToolDefinition): Groq.Chat.ChatCompletionTool {
    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    };
}

function safeParseArguments(raw: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}
