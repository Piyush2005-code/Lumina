import Groq from "groq-sdk";

import { env } from "../../config/env.js";
import type { Provider } from "../Provider.js";
import type { ChatMessage } from "../../types/Chat.js";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements Provider {

    readonly name = "groq";
    readonly defaultModel = DEFAULT_MODEL;

    private client: Groq;

    constructor() {
        if (!env.GROQ_API_KEY) {
            throw new Error("Missing GROQ_API_KEY");
        }

        this.client = new Groq({
            apiKey: env.GROQ_API_KEY
        });
    }

    async generate(
        message: string,
        model: string = DEFAULT_MODEL,
        history: ChatMessage[] = []
    ): Promise<string> {

        const messages: Groq.Chat.ChatCompletionMessageParam[] = [
            ...history.map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content
            })),
            { role: "user", content: message }
        ];

        const completion = await this.client.chat.completions.create({
            model,
            messages
        });

        return completion.choices[0].message.content ?? "";
    }
}