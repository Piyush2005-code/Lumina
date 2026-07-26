export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

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