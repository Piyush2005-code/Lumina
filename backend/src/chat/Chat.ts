export interface ChatRequest {
    provider: "groq" | "gemini";
    message: string;
}

export interface ChatResponse {
    response: string;
}