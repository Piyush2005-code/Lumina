import { GoogleGenAI } from "@google/genai";

import { env } from "../../config/env.js";
import type { Provider } from "../Provider.js";

export class GeminiProvider implements Provider {

    private client: GoogleGenAI;

    constructor() {
        if (!env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        this.client = new GoogleGenAI({
            apiKey: env.GEMINI_API_KEY
        });
    }

    async generate(message: string): Promise<string> {

        const response =
            await this.client.models.generateContent({

                model: "gemini-2.5-flash",

                contents: message

            });

        return response.text ?? "";
    }
}