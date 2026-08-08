import type { ChatMessage, ToolCallRequest } from "../types/Chat.js";

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

/**
 * Token counts as reported by the provider. Nulls rather than optionals: every
 * provider reports these inconsistently, and a missing count is a fact worth
 * carrying rather than a property to omit.
 */
export interface TokenUsage {
    promptTokens: number | null;
    completionTokens: number | null;
}

export const NO_USAGE: TokenUsage = { promptTokens: null, completionTokens: null };

/**
 * One normalised call into a model. Every provider receives exactly this shape,
 * which is what keeps provider selection out of the runtime: the runtime builds
 * a GenerateRequest, the scheduler picks who serves it.
 */
export interface GenerateRequest {
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    stream: boolean;
}

export type GenerateResponse =
    | { type: "final"; content: string; usage: TokenUsage }
    | { type: "tool_calls"; content: string; toolCalls: ToolCallRequest[]; usage: TokenUsage };

export interface Provider {
    /** Canonical provider id, matching its registry entry (e.g. "groq"). */
    readonly name: string;

    /** Model used when a request does not name one. */
    readonly defaultModel: string;

    generate(request: GenerateRequest): Promise<GenerateResponse>;
}
