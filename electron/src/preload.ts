import { contextBridge, ipcRenderer } from "electron";

import { CHANNELS } from "./shared/bridge";

/**
 * The only thing the renderer ever sees.
 *
 * `contextIsolation` keeps this file's scope separate from the page's, and
 * `contextBridge` copies across a frozen object of plain functions. React gets
 * `window.lumina` and nothing else: no `ipcRenderer`, no `require`, no `fs`,
 * no `process`, no API keys. Every call below is a fixed channel name — the
 * renderer cannot invent one.
 */

type BridgeResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Unwraps the main process's result envelope so callers get a value or an exception. */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const result = await ipcRenderer.invoke(channel, ...args) as BridgeResult<T>;
    if (!result.ok) {
        throw new Error(result.error);
    }
    return result.data;
}

const lumina = {

    chat: {
        send: (request: unknown) => invoke(CHANNELS.chatSend, request),
        continue: (conversationId: string, options?: unknown) =>
            invoke(CHANNELS.chatContinue, conversationId, options ?? {}),
        history: (conversationId: string) => invoke(CHANNELS.chatHistory, conversationId),
        conversations: () => invoke(CHANNELS.conversations),
    },

    models: {
        list: () => invoke(CHANNELS.modelsList),
    },

    tools: {
        list: () => invoke(CHANNELS.toolsList),
    },

    approvals: {
        list: (conversationId?: string) => invoke(CHANNELS.approvalsList, conversationId ?? null),
        history: () => invoke(CHANNELS.approvalsHistory),
        approve: (id: string) => invoke(CHANNELS.approvalApprove, id),
        reject: (id: string) => invoke(CHANNELS.approvalReject, id),
    },

    telemetry: {
        get: () => invoke(CHANNELS.telemetryGet),
        reset: () => invoke(CHANNELS.telemetryReset),
    },

    credentials: {
        // No `get`. Values go one way only.
        list: () => invoke(CHANNELS.credentialsList),
        set: (name: string, value: string) => invoke(CHANNELS.credentialsSet, name, value),
        remove: (name: string) => invoke(CHANNELS.credentialsRemove, name),
    },

    backend: {
        status: () => invoke(CHANNELS.backendStatus),
        restart: () => invoke(CHANNELS.backendRestart),
    },

} as const;

contextBridge.exposeInMainWorld("lumina", lumina);

export type LuminaBridge = typeof lumina;
