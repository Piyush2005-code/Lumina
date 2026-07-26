import { GroqProvider } from "./groq/GroqProvider.js";
import { GeminiProvider } from "./gemini/GeminiProvider.js";

import type { Provider } from "./Provider.js";

export class ProviderFactory {

    static get(provider: string): Provider {

        switch (provider) {

            case "groq":
                return new GroqProvider();

            case "gemini":
                return new GeminiProvider();

            default:
                throw new Error("Unknown provider.");

        }

    }

}
