import dotenv from "dotenv";

dotenv.config();

function optionalEnv(name: string): string | undefined {
    return process.env[name];
}

export const env = {
    PORT: Number(process.env.PORT) || 3000,

    OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),
    GEMINI_API_KEY: optionalEnv("GEMINI_API_KEY"),
    GROQ_API_KEY: optionalEnv("GROQ_API_KEY"),
    OPENROUTER_API_KEY: optionalEnv("OPENROUTER_API_KEY"),
    NVIDIA_NIMS_API_KEY: optionalEnv("NVIDIA_NIMS_API_KEY"),

    /** Optional OpenRouter attribution — shown on their rankings/usage pages. */
    OPENROUTER_SITE_URL: optionalEnv("OPENROUTER_SITE_URL"),
    OPENROUTER_APP_NAME: optionalEnv("OPENROUTER_APP_NAME"),

    DEFAULT_PROVIDER: process.env.DEFAULT_PROVIDER || "groq",

    /** debug | info | warn | error | silent — `debug` adds prompts, tool payloads and token usage. */
    LOG_LEVEL: optionalEnv("LOG_LEVEL"),
};