import dotenv from "dotenv";

dotenv.config();

/**
 * Credentials are read live from the process environment rather than snapshotted
 * at import time. That is deliberate: when Lumina runs inside Electron the desktop
 * shell injects provider keys into this process's environment at spawn time from
 * its OS-encrypted credential store, so nothing here ever reads a key off disk.
 */
export function credential(name: string): string | undefined {
    const value = process.env[name];
    return value !== undefined && value.length > 0 ? value : undefined;
}

export function hasCredential(name: string): boolean {
    return credential(name) !== undefined;
}

export function requireCredential(name: string): string {
    const value = credential(name);
    if (value === undefined) {
        throw new Error(`Missing credential ${name}`);
    }
    return value;
}

export const env = {
    get PORT(): number {
        return Number(process.env.PORT) || 3000;
    },

    /** Where the SQLite file lives. Electron overrides this with its userData directory. */
    get DATA_DIR(): string | undefined {
        return process.env.LUMINA_DATA_DIR;
    },

    /** Optional OpenRouter attribution — shown on their rankings/usage pages. */
    get OPENROUTER_SITE_URL(): string | undefined {
        return credential("OPENROUTER_SITE_URL");
    },
    get OPENROUTER_APP_NAME(): string | undefined {
        return credential("OPENROUTER_APP_NAME");
    },

    /** debug | info | warn | error | silent — `debug` adds prompts, tool payloads and token usage. */
    get LOG_LEVEL(): string | undefined {
        return process.env.LOG_LEVEL;
    },
};
