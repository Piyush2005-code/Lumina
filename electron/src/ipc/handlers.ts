import { ipcMain } from "electron";

import { CHANNELS } from "../shared/bridge";

import type { BackendProcess } from "../backend/BackendProcess";
import type { CredentialStore } from "../credentials/CredentialStore";

/**
 * The privileged half of the bridge.
 *
 * Every handler is a named, fixed-shape operation. There is deliberately no
 * generic "fetch this URL" or "run this route" channel: if the renderer could
 * name its own route, the allowlist would be decorative. Arguments coming from
 * the renderer are validated here rather than trusted, because "our own UI sent
 * it" is an assumption, not a guarantee.
 */
export function registerIpcHandlers(backend: BackendProcess, credentials: CredentialStore): void {

    const handle = (channel: string, fn: (...args: unknown[]) => Promise<unknown> | unknown) => {
        ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
            try {
                return { ok: true, data: await fn(...args) };
            } catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        });
    };

    /* ── Chat ─────────────────────────────────────────────────────────── */

    handle(CHANNELS.chatSend, (request) =>
        backend.request("POST", "/chat", asObject(request, "chat request")));

    handle(CHANNELS.chatContinue, (conversationId, options) =>
        backend.request("POST", `/chat/${encodeURIComponent(asId(conversationId))}/continue`, options ?? {}));

    handle(CHANNELS.chatHistory, (conversationId) =>
        backend.request("GET", `/chat/${encodeURIComponent(asId(conversationId))}`));

    handle(CHANNELS.conversations, () =>
        backend.request("GET", "/chat/conversations"));

    /* ── Catalogue ────────────────────────────────────────────────────── */

    handle(CHANNELS.modelsList, () => backend.request("GET", "/models"));
    handle(CHANNELS.toolsList, () => backend.request("GET", "/tools"));

    /* ── Approvals ────────────────────────────────────────────────────── */

    handle(CHANNELS.approvalsList, (conversationId) => {
        const id = conversationId === undefined || conversationId === null ? undefined : asId(conversationId);
        return backend.request("GET", id ? `/approvals?conversationId=${encodeURIComponent(id)}` : "/approvals");
    });

    handle(CHANNELS.approvalsHistory, () => backend.request("GET", "/approvals/history"));

    // Note what is *not* passed: the tool, the arguments, or an "approved" flag.
    // An id is the entire vocabulary the renderer has here.
    handle(CHANNELS.approvalApprove, (id) =>
        backend.request("POST", `/approvals/${encodeURIComponent(asId(id))}/approve`));

    handle(CHANNELS.approvalReject, (id) =>
        backend.request("POST", `/approvals/${encodeURIComponent(asId(id))}/reject`));

    /* ── Telemetry ────────────────────────────────────────────────────── */

    handle(CHANNELS.telemetryGet, () => backend.request("GET", "/telemetry"));
    handle(CHANNELS.telemetryReset, () => backend.request("DELETE", "/telemetry"));

    /* ── Credentials ──────────────────────────────────────────────────── */
    /* There is no "get" channel. The renderer can learn that a key is set and
     * can replace it; it can never read one back. */

    handle(CHANNELS.credentialsList, () => ({ credentials: credentials.list() }));

    handle(CHANNELS.credentialsSet, async (name, value) => {
        const result = credentials.set(asId(name), asString(value, "credential value"));
        if (!result.ok) {
            throw new Error(result.error);
        }
        // A new key is worthless until the process holding the old environment restarts.
        await backend.restart();
        return { credentials: credentials.list(), backend: backend.status() };
    });

    handle(CHANNELS.credentialsRemove, async (name) => {
        credentials.remove(asId(name));
        await backend.restart();
        return { credentials: credentials.list(), backend: backend.status() };
    });

    /* ── Backend lifecycle ────────────────────────────────────────────── */

    handle(CHANNELS.backendStatus, () => backend.status());
    handle(CHANNELS.backendRestart, () => backend.restart());
}

function asObject(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid ${label}`);
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
    if (typeof value !== "string") {
        throw new Error(`Invalid ${label}`);
    }
    return value;
}

/** Ids go into URLs, so they are constrained rather than merely type-checked. */
function asId(value: unknown): string {
    const text = asString(value, "identifier");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text)) {
        throw new Error("Malformed identifier");
    }
    return text;
}
