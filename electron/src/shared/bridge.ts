/**
 * The complete contract between the renderer and the main process.
 *
 * Every capability the UI has is named here. There is no general-purpose
 * "invoke anything" channel and no Node API reaches the renderer, so this list
 * *is* the renderer's privilege set — auditable by reading one file.
 */

export const CHANNELS = {
    chatSend: "chat:send",
    chatContinue: "chat:continue",
    chatHistory: "chat:history",
    conversations: "chat:conversations",

    modelsList: "models:list",
    toolsList: "tools:list",

    approvalsList: "approvals:list",
    approvalsHistory: "approvals:history",
    approvalApprove: "approvals:approve",
    approvalReject: "approvals:reject",

    telemetryGet: "telemetry:get",
    telemetryReset: "telemetry:reset",

    credentialsList: "credentials:list",
    credentialsSet: "credentials:set",
    credentialsRemove: "credentials:remove",

    backendStatus: "backend:status",
    backendRestart: "backend:restart",
} as const;

export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS];

/** What the renderer may know about a credential: that it exists, never its value. */
export interface CredentialStatus {
    name: string;
    label: string;
    /** True when a value is stored. The value itself never crosses this boundary. */
    set: boolean;
    /** Whether this credential is required for a provider or optional (e.g. SMTP). */
    category: "provider" | "email";
}

export interface BackendStatus {
    state: "starting" | "running" | "attached" | "stopped" | "failed";
    url: string;
    /** Set when state is "failed". */
    error: string | null;
    /** True when the backend was already running and Lumina attached rather than spawning it. */
    external: boolean;
    encryptionAvailable: boolean;
}
