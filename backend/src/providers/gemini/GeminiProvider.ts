import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";

import { requireCredential } from "../../config/env.js";
import { createLogger, startTimer } from "../../utils/logger.js";

import type { Content } from "@google/genai";
import type { GenerateRequest, GenerateResponse, Provider, ToolDefinition, TokenUsage } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

const log = createLogger("gemini");

export class GeminiProvider implements Provider {

    readonly name = "gemini";
    readonly defaultModel = DEFAULT_MODEL;

    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: requireCredential("GEMINI_API_KEY") });
    }

    async generate(request: GenerateRequest): Promise<GenerateResponse> {

        const apiTimer = startTimer();
        const model = request.model || DEFAULT_MODEL;

        // Gemini takes the system prompt out of band rather than as a turn.
        const systemInstruction = request.messages
            .filter(message => message.role === "system")
            .map(message => message.content)
            .join("\n\n");

        const contents = request.messages
            .filter(message => message.role !== "system")
            .map(toGeminiContent);

        const response = await this.client.models.generateContent({
            model,
            contents,
            ...(request.tools.length > 0 || systemInstruction.length > 0
                ? {
                    config: {
                        ...(systemInstruction.length > 0 ? { systemInstruction } : {}),
                        ...(request.tools.length > 0
                            ? { tools: [{ functionDeclarations: request.tools.map(toGeminiFunctionDeclaration) }] }
                            : {}),
                    },
                }
                : {}),
        });

        const usage: TokenUsage = {
            promptTokens: response.usageMetadata?.promptTokenCount ?? null,
            completionTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        };

        log.debug("completion", {
            model,
            ms: apiTimer(),
            finish: response.candidates?.[0]?.finishReason,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            // 2.5 models burn hidden reasoning tokens, which is often the real cost of a slow turn.
            thoughtTokens: response.usageMetadata?.thoughtsTokenCount,
        });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            return {
                type: "tool_calls",
                content: response.text ?? "",
                usage,
                toolCalls: functionCalls.map(call => ({
                    id: call.id ?? randomUUID(),
                    name: call.name ?? "",
                    arguments: call.args ?? {},
                })),
            };
        }

        return { type: "final", content: response.text ?? "", usage };
    }
}

function toGeminiContent(message: ChatMessage): Content {
    switch (message.role) {

        case "system":
            // Filtered out before this point; mapped defensively so the switch stays total.
            return { role: "user", parts: [{ text: message.content }] };

        case "user":
            return { role: "user", parts: [{ text: message.content }] };

        case "assistant":
            if (message.toolCalls && message.toolCalls.length > 0) {
                return {
                    role: "model",
                    parts: message.toolCalls.map(call => ({
                        functionCall: { id: call.id, name: call.name, args: call.arguments },
                    })),
                };
            }
            return { role: "model", parts: [{ text: message.content }] };

        case "tool":
            // Gemini expects function results echoed back as a "user" turn.
            return {
                role: "user",
                parts: [{
                    functionResponse: {
                        id: message.toolCallId,
                        name: message.toolName,
                        response: { output: message.content },
                    },
                }],
            };

    }
}

function toGeminiFunctionDeclaration(tool: ToolDefinition) {
    return {
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parameters,
    };
}
