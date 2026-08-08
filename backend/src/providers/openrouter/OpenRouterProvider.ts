import { env, requireCredential } from "../../config/env.js";
import { OpenAICompatibleProvider } from "../openaiCompatible/OpenAICompatibleProvider.js";

const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";

const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * OpenRouter fronts many vendors behind one key, so model ids are namespaced
 * as "vendor/model" (e.g. "anthropic/claude-sonnet-4.5", "openai/gpt-4o-mini").
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {

    constructor() {
        super({
            name: "openrouter",
            defaultModel: DEFAULT_MODEL,
            apiKey: requireCredential("OPENROUTER_API_KEY"),
            baseURL: BASE_URL,
            // Optional attribution headers — they let OpenRouter label this app
            // on its rankings page and in your usage dashboard.
            defaultHeaders: {
                "HTTP-Referer": env.OPENROUTER_SITE_URL ?? "http://localhost",
                "X-Title": env.OPENROUTER_APP_NAME ?? "Lumina",
            },
        });
    }
}
