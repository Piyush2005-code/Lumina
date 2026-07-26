import { Router } from "express";

/**
 * GET /models
 *
 * Returns the catalogue of supported providers and their available models.
 * The frontend uses this to dynamically populate the model selector UI.
 * Add new providers/models here as the backend grows.
 */

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    contextWindow?: number;
}

export interface ProviderInfo {
    id: string;
    name: string;
    defaultModel: string;
    models: ModelInfo[];
}

const CATALOGUE: ProviderInfo[] = [
    {
        id: "groq",
        name: "Groq",
        defaultModel: "llama-3.3-70b-versatile",
        models: [
            {
                id: "llama-3.3-70b-versatile",
                name: "Llama 3.3 70B",
                description: "Meta's flagship open model — fast, versatile.",
                contextWindow: 128000,
            },
            {
                id: "llama-3.1-8b-instant",
                name: "Llama 3.1 8B Instant",
                description: "Ultra-fast responses for lighter tasks.",
                contextWindow: 128000,
            },
            {
                id: "mixtral-8x7b-32768",
                name: "Mixtral 8×7B",
                description: "Mixture-of-experts model with 32k context.",
                contextWindow: 32768,
            },
        ],
    },
    {
        id: "gemini",
        name: "Google Gemini",
        defaultModel: "gemini-2.5-flash",
        models: [
            {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                description: "Google's fastest multimodal model.",
                contextWindow: 1000000,
            },
            {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                description: "Most capable Gemini model for complex tasks.",
                contextWindow: 1000000,
            },
        ],
    },
];

const router = Router();

router.get("/", (_req, res) => {
    res.json({ providers: CATALOGUE });
});

export default router;
