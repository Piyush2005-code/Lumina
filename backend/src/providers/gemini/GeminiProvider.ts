import { GoogleGenAI } from "@google/genai";

import { env } from "../../config/env.js";
import type { Provider } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

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
        message: string,
        model: string = DEFAULT_MODEL,
        history: ChatMessage[] = []
    ): Promise<string> {

        // Build a conversation-aware prompt by prepending history.
        const historyText = history
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const fullPrompt = historyText
            ? `${historyText}\nUser: ${message}`
            : message;

        const response = await this.client.models.generateContent({
            model,
            contents: fullPrompt
        });

        return response.text ?? "";
    }
}