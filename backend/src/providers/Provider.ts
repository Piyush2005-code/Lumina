import type { ChatMessage } from "../types/Chat.js";

export interface Provider {
    /** The canonical provider name (e.g. "groq", "gemini"). */
    readonly name: string;

    /** The default model used when none is specified. */
    readonly defaultModel: string;

    /** Generate a response given a user message and optional conversation history. */
    generate(message: string, model?: string, history?: ChatMessage[]): Promise<string>;
}