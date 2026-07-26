import Groq from "groq-sdk";

import { env } from "../../config/env.js";
import type { Provider } from "../Provider.js";

export class GroqProvider implements Provider {

    private client: Groq;

    constructor() {
        if (!env.GROQ_API_KEY) {
            throw new Error("Missing GROQ_API_KEY");
        }

        this.client = new Groq({
            apiKey: env.GROQ_API_KEY
        });
    }

    async generate(message: string): Promise<string> {

        const completion =
            await this.client.chat.completions.create({

                model: "llama-3.3-70b-versatile",

                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ]

            });

        return completion.choices[0].message.content ?? "";
    }
}