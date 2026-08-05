import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.js";
import { createLogger, startTimer } from "../../utils/logger.js";

import type { Content } from "@google/genai";
import type { GenerateResult, Provider, ToolDefinition } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

const log = createLogger("gemini");

export class GeminiProvider implements Provider {

    readonly name = "gemini";
    readonly defaultModel = DEFAULT_MODEL;

    private client: GoogleGenAI;

    constructor() {
        if (!env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        this.client = new GoogleGenAI({
            apiKey: env.GEMINI_API_KEY
        });
    }

    async generate(
        messages: ChatMessage[],
        model: string = DEFAULT_MODEL,
        tools: ToolDefinition[] = []
    ): Promise<GenerateResult> {

        const apiTimer = startTimer();

        const response = await this.client.models.generateContent({
            model,
            contents: messages.map(toGeminiContent),
            ...(tools.length > 0
                ? { config: { tools: [{ functionDeclarations: tools.map(toGeminiFunctionDeclaration) }] } }
                : {}),
        });

        log.debug("completion", {
            model,
            ms: apiTimer(),
            finish: response.candidates?.[0]?.finishReason,
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            // 2.5 models burn hidden reasoning tokens, which is often the real cost of a slow turn.
            thoughtTokens: response.usageMetadata?.thoughtsTokenCount,
        });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            return {
                type: "tool_calls",
                content: response.text ?? "",
                toolCalls: functionCalls.map(call => ({
                    id: call.id ?? randomUUID(),
                    name: call.name ?? "",
                    arguments: call.args ?? {},
                })),
            };
        }

        return { type: "final", content: response.text ?? "" };
    }
}

function toGeminiContent(message: ChatMessage): Content {
    switch (message.role) {

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
