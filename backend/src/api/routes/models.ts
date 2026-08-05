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
    {
        id: "openrouter",
        name: "OpenRouter",
        defaultModel: "meta-llama/llama-3.3-70b-instruct",
        models: [
            {
                id: "meta-llama/llama-3.3-70b-instruct",
                name: "Llama 3.3 70B",
                description: "Meta's flagship open model, routed via OpenRouter.",
                contextWindow: 131072,
            },
            {
                id: "openai/gpt-4o-mini",
                name: "GPT-4o mini",
                description: "Cheap, quick OpenAI model for everyday tasks.",
                contextWindow: 128000,
            },
            {
                id: "anthropic/claude-sonnet-4.5",
                name: "Claude Sonnet 4.5",
                description: "Strong all-rounder for coding and long context.",
                contextWindow: 1000000,
            },
            {
                id: "deepseek/deepseek-chat",
                name: "DeepSeek Chat",
                description: "Capable open model at a low price point.",
                contextWindow: 163840,
            },
            {
                id: "qwen/qwen3-235b-a22b",
                name: "Qwen3 235B A22B",
                description: "Large mixture-of-experts model from Alibaba.",
                contextWindow: 131072,
            },
        ],
    },
    {
        id: "nvidia",
        name: "NVIDIA NIM",
        defaultModel: "meta/llama-3.1-70b-instruct",
        // Only models verified as actually served on this account are listed —
        // NVIDIA advertises far more via /v1/models than it will serve.
        models: [
            {
                id: "meta/llama-3.1-70b-instruct",
                name: "Llama 3.1 70B",
                description: "Capable open model with reliable tool calling.",
                contextWindow: 128000,
            },
            {
                id: "meta/llama-3.1-8b-instruct",
                name: "Llama 3.1 8B",
                description: "Small and fast for lighter tasks.",
                contextWindow: 128000,
            },
        ],
    },
];

const router = Router();

router.get("/", (_req, res) => {
    res.json({ providers: CATALOGUE });
});

export default router;
