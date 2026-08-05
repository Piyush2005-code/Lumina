export interface ToolCallRequest {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export type ChatMessage =
    | { role: "user"; content: string }
    | { role: "assistant"; content: string; toolCalls?: ToolCallRequest[] }
    | { role: "tool"; toolCallId: string; toolName: string; content: string };

export type ProviderName = "groq" | "gemini" | "openrouter" | "nvidia";

export interface ChatRequest {
    provider: ProviderName;
    model?: string;
    message: string;
    history?: ChatMessage[];
}

export interface ChatResponse {
    response: string;
    provider: string;
    model: string;
}
