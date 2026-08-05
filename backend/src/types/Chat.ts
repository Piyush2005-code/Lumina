export interface ToolCallRequest {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export type ChatMessage =
    | { role: "user"; content: string }
    | { role: "assistant"; content: string; toolCalls?: ToolCallRequest[] }
    | { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface ChatRequest {
    provider: "groq" | "gemini";
    model?: string;
    message: string;
    history?: ChatMessage[];
}

export interface ChatResponse {
    response: string;
    provider: string;
    model: string;
}
