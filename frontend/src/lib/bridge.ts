/**
 * How the renderer reaches the backend.
 *
 * Inside the desktop app there is exactly one route: `window.lumina`, the frozen
 * object the preload script exposes over contextBridge. The renderer has no Node
 * access and no API keys, and every privileged operation is a named channel the
 * main process implements.
 *
 * In a plain browser (`npm run dev` in frontend/ without Electron) that object is
 * absent, so the same calls fall back to HTTP against the dev backend. The
 * fallback exists for development ergonomics — the packaged app never uses it.
 */

export interface LuminaBridge {
    chat: {
        send(request: unknown): Promise<unknown>;
        continue(conversationId: string, options?: unknown): Promise<unknown>;
        history(conversationId: string): Promise<unknown>;
        conversations(): Promise<unknown>;
    };
    models: { list(): Promise<unknown> };
    tools: { list(): Promise<unknown> };
    approvals: {
        list(conversationId?: string): Promise<unknown>;
        history(): Promise<unknown>;
        approve(id: string): Promise<unknown>;
        reject(id: string): Promise<unknown>;
    };
    telemetry: {
        get(): Promise<unknown>;
        reset(): Promise<unknown>;
    };
    credentials: {
        list(): Promise<unknown>;
        set(name: string, value: string): Promise<unknown>;
        remove(name: string): Promise<unknown>;
    };
    backend: {
        status(): Promise<unknown>;
        restart(): Promise<unknown>;
    };
}

declare global {
    interface Window {
        lumina?: LuminaBridge;
    }
}

export const bridge: LuminaBridge | undefined =
    typeof window !== "undefined" ? window.lumina : undefined;

/** True when running inside the Electron shell rather than a browser tab. */
export const isDesktop = bridge !== undefined;

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Browser-only fallback path. */
export async function http<T>(method: string, route: string, body?: unknown): Promise<T> {

    const response = await fetch(`${BASE}${route}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    const parsed: unknown = text.length > 0 ? JSON.parse(text) : {};

    if (!response.ok) {
        const message =
            typeof parsed === "object" && parsed !== null && "error" in parsed
                ? String((parsed as { error: unknown }).error)
                : `Request failed with ${response.status}`;
        throw new Error(message);
    }

    return parsed as T;
}
