import { providerRegistry } from "../providers/ProviderRegistry.js";
import { GroqProvider } from "../providers/groq/GroqProvider.js";
import { GeminiProvider } from "../providers/gemini/GeminiProvider.js";
import { OpenRouterProvider } from "../providers/openrouter/OpenRouterProvider.js";
import { NvidiaProvider } from "../providers/nvidia/NvidiaProvider.js";

/**
 * The one file that knows the concrete provider list. Everything downstream —
 * scheduler, runtime, routes — works against the registry, so adding a provider
 * means adding a `register()` call here and catalogue entries in capabilities.ts.
 */
export function registerProviders(): void {
    providerRegistry
        .register({
            id: "groq",
            label: "Groq",
            credentials: ["GROQ_API_KEY"],
            create: () => new GroqProvider(),
        })
        .register({
            id: "gemini",
            label: "Google Gemini",
            credentials: ["GEMINI_API_KEY"],
            create: () => new GeminiProvider(),
        })
        .register({
            id: "openrouter",
            label: "OpenRouter",
            credentials: ["OPENROUTER_API_KEY"],
            create: () => new OpenRouterProvider(),
        })
        .register({
            id: "nvidia",
            label: "NVIDIA NIM",
            credentials: ["NVIDIA_NIMS_API_KEY"],
            create: () => new NvidiaProvider(),
        });
}
