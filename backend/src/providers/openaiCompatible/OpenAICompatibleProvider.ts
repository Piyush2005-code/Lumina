import OpenAI from "openai";

import { createLogger, startTimer } from "../../utils/logger.js";

import type { GenerateRequest, GenerateResponse, Provider, ToolDefinition, TokenUsage } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

export interface OpenAICompatibleOptions {
    /** Canonical provider name, used for routing and logging. */
    name: string;
    /** Model used when the request doesn't name one. */
    defaultModel: string;
    apiKey: string;
    /** Root of the OpenAI-compatible API, e.g. https://openrouter.ai/api/v1 */
    baseURL: string;
    /** Extra headers some gateways use for attribution or routing. */
    defaultHeaders?: Record<string, string>;
}

/**
 * Shared implementation for gateways that speak the OpenAI chat-completions
 * dialect — OpenRouter and NVIDIA NIM both do, so they differ only in base
 * URL, credentials and model naming.
 */
export class OpenAICompatibleProvider implements Provider {

    readonly name: string;
    readonly defaultModel: string;

    protected client: OpenAI;
    protected log: ReturnType<typeof createLogger>;

    constructor(options: OpenAICompatibleOptions) {

        this.name = options.name;
        this.defaultModel = options.defaultModel;
        this.log = createLogger(options.name);

        this.client = new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseURL,
            ...(options.defaultHeaders ? { defaultHeaders: options.defaultHeaders } : {}),
        });
    }

    async generate(request: GenerateRequest): Promise<GenerateResponse> {

        const apiTimer = startTimer();
        const model = request.model || this.defaultModel;

        const completion = await this.client.chat.completions.create({
            model,
            messages: request.messages.map(toOpenAIMessage),
            // Matches the Groq provider: structured tool-call output is steadier at 0.
            ...(request.tools.length > 0 ? { tools: request.tools.map(toOpenAITool), temperature: 0 } : {}),
        });

        const choice = completion.choices[0]?.message;

        const usage: TokenUsage = {
            promptTokens: completion.usage?.prompt_tokens ?? null,
            completionTokens: completion.usage?.completion_tokens ?? null,
        };

        this.log.debug("completion", {
            model,
            ms: apiTimer(),
            finish: completion.choices[0]?.finish_reason,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
        });

        if (choice?.tool_calls && choice.tool_calls.length > 0) {
            return {
                type: "tool_calls",
                content: choice.content ?? "",
                usage,
                toolCalls: choice.tool_calls.flatMap(call => (
                    // Only function calls map onto our ToolCallRequest shape; newer
                    // SDKs can also return custom-tool calls, which we don't offer.
                    call.type === "function"
                        ? [{
                            id: call.id,
                            name: call.function.name,
                            arguments: safeParseArguments(call.function.arguments),
                        }]
                        : []
                )),
            };
        }

        return { type: "final", content: choice?.content ?? "", usage };
    }
}

function toOpenAIMessage(message: ChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
    switch (message.role) {

        case "system":
            return { role: "system", content: message.content };

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

function toOpenAITool(tool: ToolDefinition): OpenAI.Chat.ChatCompletionTool {
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
