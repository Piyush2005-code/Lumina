import { GroqProvider } from "./groq/GroqProvider.js";
import { GeminiProvider } from "./gemini/GeminiProvider.js";
import { OpenRouterProvider } from "./openrouter/OpenRouterProvider.js";
import { NvidiaProvider } from "./nvidia/NvidiaProvider.js";

import type { Provider } from "./Provider.js";

const FACTORIES: Record<string, () => Provider> = {
    groq: () => new GroqProvider(),
    gemini: () => new GeminiProvider(),
    openrouter: () => new OpenRouterProvider(),
    nvidia: () => new NvidiaProvider(),
};

export class ProviderFactory {

    static get(provider: string): Provider {

        const factory = FACTORIES[provider];

        if (!factory) {
            throw new Error(`Unknown provider "${provider}". Supported: ${ProviderFactory.supported().join(", ")}`);
        }

        return factory();

    }

    /** Every provider id the factory can build, regardless of whether its key is set. */
    static supported(): string[] {
        return Object.keys(FACTORIES);
    }

}
