import { requireCredential } from "../../config/env.js";
import { OpenAICompatibleProvider } from "../openaiCompatible/OpenAICompatibleProvider.js";

/**
 * llama-3.1-70b rather than 3.3-70b: /v1/models lists the whole NVIDIA
 * catalogue, but only a subset is actually served for a given account — the
 * rest either 404 ("Function not found") or hang without ever responding.
 * 3.3-70b hangs on this account; 3.1-70b answers and calls tools reliably.
 */
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

const BASE_URL = "https://integrate.api.nvidia.com/v1";

export class NvidiaProvider extends OpenAICompatibleProvider {

    constructor() {
        super({
            name: "nvidia",
            defaultModel: DEFAULT_MODEL,
            apiKey: requireCredential("NVIDIA_NIMS_API_KEY"),
            baseURL: BASE_URL,
        });
    }
}
