import type { ChatMessage, ToolCallRequest } from "../types/Chat.js";

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export type GenerateResult =
    | { type: "final"; content: string }
    | { type: "tool_calls"; content: string; toolCalls: ToolCallRequest[] };

export interface Provider {
    /** The canonical provider name (e.g. "groq", "gemini"). */
    readonly name: string;

    /** The default model used when none is specified. */
    readonly defaultModel: string;

    /**
     * Generate the next turn given the full conversation so far (including
     * any prior tool calls/results). Returns either a final answer or a
     * request to run one or more tools before continuing.
     */
    generate(messages: ChatMessage[], model?: string, tools?: ToolDefinition[]): Promise<GenerateResult>;
}
