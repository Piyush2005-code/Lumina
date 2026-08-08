/**
 * What a model can actually do, expressed as data rather than as branches.
 *
 * The scheduler filters on these before it ranks anything, so "this task needs
 * tool calling and a 200k window" narrows the candidate set without a single
 * provider name appearing in the routing code.
 */
export interface ModelCapabilities {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    maxContext: number;
    /** USD per million tokens. A routing signal, not billing — approximate is fine. */
    costPerMillionInput: number;
    costPerMillionOutput: number;
    /** Coarse capability tier, 1 (small/fast) to 5 (frontier). Used when preference is "quality". */
    quality: number;
    /** Latency assumption used until real telemetry exists for this model. */
    priorLatencyMs: number;
}

export interface ModelDescriptor {
    id: string;
    name: string;
    description: string;
    providerId: string;
    capabilities: ModelCapabilities;
}

/** Sensible baseline so each entry below only states what differs. */
function caps(overrides: Partial<ModelCapabilities>): ModelCapabilities {
    return {
        streaming: true,
        tools: true,
        vision: false,
        maxContext: 128_000,
        costPerMillionInput: 0.5,
        costPerMillionOutput: 1.5,
        quality: 3,
        priorLatencyMs: 1_500,
        ...overrides,
    };
}

export const MODEL_CATALOGUE: ModelDescriptor[] = [

    /* ── Groq — fastest inference, open models ─────────────────────────── */
    {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        description: "Meta's flagship open model — fast, versatile, reliable tool calling.",
        providerId: "groq",
        capabilities: caps({ maxContext: 128_000, quality: 4, priorLatencyMs: 600, costPerMillionInput: 0.59, costPerMillionOutput: 0.79 }),
    },
    {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        description: "Ultra-fast responses for lighter tasks.",
        providerId: "groq",
        capabilities: caps({ maxContext: 128_000, quality: 2, priorLatencyMs: 250, costPerMillionInput: 0.05, costPerMillionOutput: 0.08 }),
    },

    /* ── Google Gemini — multimodal, very large context ────────────────── */
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Google's fastest multimodal model — handles images and long context.",
        providerId: "gemini",
        capabilities: caps({ vision: true, maxContext: 1_000_000, quality: 4, priorLatencyMs: 1_200, costPerMillionInput: 0.3, costPerMillionOutput: 2.5 }),
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Most capable Gemini model for complex reasoning.",
        providerId: "gemini",
        capabilities: caps({ vision: true, maxContext: 1_000_000, quality: 5, priorLatencyMs: 4_000, costPerMillionInput: 1.25, costPerMillionOutput: 10 }),
    },

    /* ── OpenRouter — many vendors behind one key ──────────────────────── */
    {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B (OpenRouter)",
        description: "Meta's flagship open model, routed via OpenRouter.",
        providerId: "openrouter",
        capabilities: caps({ maxContext: 131_072, quality: 4, priorLatencyMs: 2_000, costPerMillionInput: 0.12, costPerMillionOutput: 0.3 }),
    },
    {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o mini",
        description: "Cheap, quick, multimodal OpenAI model for everyday tasks.",
        providerId: "openrouter",
        capabilities: caps({ vision: true, maxContext: 128_000, quality: 3, priorLatencyMs: 1_500, costPerMillionInput: 0.15, costPerMillionOutput: 0.6 }),
    },
    {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        description: "Strong all-rounder for coding and long context.",
        providerId: "openrouter",
        capabilities: caps({ vision: true, maxContext: 200_000, quality: 5, priorLatencyMs: 3_000, costPerMillionInput: 3, costPerMillionOutput: 15 }),
    },
    {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek Chat",
        description: "Capable open model at a low price point.",
        providerId: "openrouter",
        capabilities: caps({ maxContext: 163_840, quality: 4, priorLatencyMs: 3_500, costPerMillionInput: 0.14, costPerMillionOutput: 0.28 }),
    },

    /* ── NVIDIA NIM ────────────────────────────────────────────────────── */
    {
        id: "meta/llama-3.1-70b-instruct",
        name: "Llama 3.1 70B (NIM)",
        description: "Capable open model with reliable tool calling.",
        providerId: "nvidia",
        capabilities: caps({ maxContext: 128_000, quality: 4, priorLatencyMs: 2_500 }),
    },
    {
        id: "meta/llama-3.1-8b-instruct",
        name: "Llama 3.1 8B (NIM)",
        description: "Small and fast for lighter tasks.",
        providerId: "nvidia",
        capabilities: caps({ maxContext: 128_000, quality: 2, priorLatencyMs: 1_000 }),
    },
];
