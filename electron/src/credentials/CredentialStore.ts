import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

import type { CredentialStatus } from "../shared/bridge";

/**
 * Local credential isolation.
 *
 * API keys are encrypted with Electron's safeStorage, which is backed by the
 * OS keychain — Keychain on macOS, DPAPI on Windows, libsecret on Linux. The
 * ciphertext lives in the app's userData directory; the key material never
 * does, and never leaves the main process.
 *
 * Three rules hold this together:
 *
 *   1. The renderer cannot read a value. The IPC surface exposes `list` (names
 *      and whether each is set) and `set`/`remove`. There is no `get`.
 *   2. Values are handed to exactly one place — the backend child process's
 *      environment, at spawn time — so they are never written to a .env file,
 *      never bundled into the renderer, and never sent over HTTP.
 *   3. If the OS cannot encrypt, nothing is written. Silently falling back to
 *      plaintext would make the guarantee a lie.
 */

export const KNOWN_CREDENTIALS: ReadonlyArray<Omit<CredentialStatus, "set">> = [
    { name: "GROQ_API_KEY", label: "Groq API key", category: "provider" },
    { name: "GEMINI_API_KEY", label: "Google Gemini API key", category: "provider" },
    { name: "OPENROUTER_API_KEY", label: "OpenRouter API key", category: "provider" },
    { name: "NVIDIA_NIMS_API_KEY", label: "NVIDIA NIM API key", category: "provider" },
    { name: "SMTP_HOST", label: "SMTP host", category: "email" },
    { name: "SMTP_PORT", label: "SMTP port", category: "email" },
    { name: "SMTP_USER", label: "SMTP username", category: "email" },
    { name: "SMTP_PASSWORD", label: "SMTP password", category: "email" },
    { name: "SMTP_FROM", label: "Sender address", category: "email" },
];

const KNOWN_NAMES = new Set(KNOWN_CREDENTIALS.map(entry => entry.name));

export class CredentialStore {

    private readonly file: string;

    /** name → base64 ciphertext. Each value is encrypted separately. */
    private entries: Record<string, string> = {};

    constructor() {
        this.file = path.join(app.getPath("userData"), "credentials.enc");
        this.load();
    }

    isEncryptionAvailable(): boolean {
        return safeStorage.isEncryptionAvailable();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.file)) {
                this.entries = JSON.parse(fs.readFileSync(this.file, "utf8")) as Record<string, string>;
            }
        } catch (error) {
            console.error("[lumina] could not read credential store:", error);
            this.entries = {};
        }
    }

    private persist(): void {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        // Owner-only: the ciphertext is useless without the OS key, but there is
        // no reason for another account on the machine to hold a copy of it.
        fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 2), { mode: 0o600 });
    }

    list(): CredentialStatus[] {
        return KNOWN_CREDENTIALS.map(entry => ({
            ...entry,
            set: this.entries[entry.name] !== undefined,
        }));
    }

    set(name: string, value: string): { ok: true } | { ok: false; error: string } {

        if (!KNOWN_NAMES.has(name)) {
            return { ok: false, error: `Unknown credential "${name}"` };
        }

        if (value.length === 0) {
            this.remove(name);
            return { ok: true };
        }

        if (!safeStorage.isEncryptionAvailable()) {
            return {
                ok: false,
                error: "This system has no OS keychain available, so credentials cannot be stored securely. " +
                    "Nothing was saved. Set the key as an environment variable instead.",
            };
        }

        this.entries[name] = safeStorage.encryptString(value).toString("base64");
        this.persist();

        return { ok: true };
    }

    remove(name: string): void {
        delete this.entries[name];
        this.persist();
    }

    /**
     * Decrypted values, for injection into the backend's environment.
     *
     * Main process only — this method has no IPC handler, by design. A corrupt or
     * undecryptable entry is skipped rather than crashing startup.
     */
    resolveAll(): Record<string, string> {

        const resolved: Record<string, string> = {};

        if (!safeStorage.isEncryptionAvailable()) {
            return resolved;
        }

        for (const [name, ciphertext] of Object.entries(this.entries)) {
            try {
                resolved[name] = safeStorage.decryptString(Buffer.from(ciphertext, "base64"));
            } catch (error) {
                console.error(`[lumina] could not decrypt credential ${name}:`, error);
            }
        }

        return resolved;
    }

    count(): number {
        return Object.keys(this.entries).length;
    }
}
