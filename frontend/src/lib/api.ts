import { bridge, http, isDesktop } from "./bridge.ts";

export { isDesktop };

/* ─── Types (mirrors of the backend's response shapes) ──────────────── */

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolCalls?: ToolCallRequest[];
    toolCallId?: string;
    toolName?: string;
}

export interface ToolCallRequest {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export type RoutingPreference = "speed" | "quality" | "cost" | "balanced";

export interface ToolInvocation {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: string;
    policy: string;
    result?: string;
    isError?: boolean;
    ms?: number;
}

export interface Approval {
    id: string;
    conversationId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    status: string;
    reason: string;
    createdAt: number;
    expiresAt: number;
    decidedAt?: number | null;
    decidedBy?: string | null;
}

export interface CapabilityRequirements {
    tools: boolean;
    vision: boolean;
    streaming: boolean;
    minContext: number;
}

export interface Failover {
    from: string;
    to: string;
    reason: string;
    detail: string;
}

export interface ChatResponse {
    status: "complete" | "awaiting_approval";
    conversationId: string;
    response: string;
    provider: string;
    model: string;
    toolCalls: ToolInvocation[];
    pendingApprovals: Approval[];
    routing: {
        preference: RoutingPreference;
        requirements: CapabilityRequirements;
        rationale: string;
        failovers: Failover[];
        ms: number;
    };
}

export interface ChatRequest {
    message: string;
    conversationId?: string;
    provider?: string;
    model?: string;
    preference?: RoutingPreference;
}

export interface ModelCapabilities {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    maxContext: number;
    costPerMillionInput: number;
    costPerMillionOutput: number;
    quality: number;
    priorLatencyMs: number;
}

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    capabilities: ModelCapabilities;
}

export interface ProviderInfo {
    id: string;
    name: string;
    configured: boolean;
    missingCredentials: string[];
    defaultModel: string | null;
    models: ModelInfo[];
}

export interface ModelsResponse {
    providers: ProviderInfo[];
}

export interface ToolInfo {
    name: string;
    description: string;
    executionPolicy: "READ_ONLY" | "APPROVAL_REQUIRED";
    server: string;
    serverId: string | null;
}

export interface ToolsResponse {
    tools: ToolInfo[];
    counts: { total: number; readOnly: number; approvalRequired: number };
}

export interface ModelStats {
    provider: string;
    model: string;
    calls: number;
    errors: number;
    errorRate: number;
    avgMs: number | null;
    p50Ms: number | null;
    p95Ms: number | null;
    minMs: number | null;
    maxMs: number | null;
    lastMs: number | null;
    lastAt: number | null;
    promptTokens: number;
    completionTokens: number;
}

export interface TelemetrySnapshot {
    stats: ModelStats[];
    totals: {
        providerCalls: number;
        errors: number;
        promptTokens: number;
        completionTokens: number;
    };
    windowMs: number;
    since: number;
    cooldowns?: { provider: string; remainingMs: number }[];
}

export interface CredentialStatus {
    name: string;
    label: string;
    set: boolean;
    category: "provider" | "email";
}

export interface BackendStatus {
    state: "starting" | "running" | "attached" | "stopped" | "failed";
    url: string;
    error: string | null;
    external: boolean;
    encryptionAvailable: boolean;
}

/* ─── Calls ──────────────────────────────────────────────────────────
 * Each one goes through the IPC bridge when it exists and over HTTP when it
 * does not, so no component ever has to know which shell it is running in.
 */

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return bridge
        ? (bridge.chat.send(request) as Promise<ChatResponse>)
        : http<ChatResponse>("POST", "/chat", request);
}

export async function continueTurn(
    conversationId: string,
    options: { preference?: RoutingPreference } = {},
): Promise<ChatResponse> {
    return bridge
        ? (bridge.chat.continue(conversationId, options) as Promise<ChatResponse>)
        : http<ChatResponse>("POST", `/chat/${conversationId}/continue`, options);
}

export async function fetchModels(): Promise<ModelsResponse> {
    return bridge
        ? (bridge.models.list() as Promise<ModelsResponse>)
        : http<ModelsResponse>("GET", "/models");
}

export async function fetchTools(): Promise<ToolsResponse> {
    return bridge
        ? (bridge.tools.list() as Promise<ToolsResponse>)
        : http<ToolsResponse>("GET", "/tools");
}

export async function fetchApprovals(conversationId?: string): Promise<{ approvals: Approval[] }> {
    if (bridge) {
        return bridge.approvals.list(conversationId) as Promise<{ approvals: Approval[] }>;
    }
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
    return http<{ approvals: Approval[] }>("GET", `/approvals${query}`);
}

export async function approveCall(id: string): Promise<{ approval: Approval }> {
    return bridge
        ? (bridge.approvals.approve(id) as Promise<{ approval: Approval }>)
        : http<{ approval: Approval }>("POST", `/approvals/${id}/approve`);
}

export async function rejectCall(id: string): Promise<{ approval: Approval }> {
    return bridge
        ? (bridge.approvals.reject(id) as Promise<{ approval: Approval }>)
        : http<{ approval: Approval }>("POST", `/approvals/${id}/reject`);
}

export async function fetchTelemetry(): Promise<TelemetrySnapshot> {
    return bridge
        ? (bridge.telemetry.get() as Promise<TelemetrySnapshot>)
        : http<TelemetrySnapshot>("GET", "/telemetry");
}

export async function resetTelemetry(): Promise<TelemetrySnapshot> {
    return bridge
        ? (bridge.telemetry.reset() as Promise<TelemetrySnapshot>)
        : http<TelemetrySnapshot>("DELETE", "/telemetry");
}

/* Credentials only exist in the desktop shell — a browser tab has no keychain
 * to put them in, so these reject rather than pretending to work. */

export async function fetchCredentials(): Promise<{ credentials: CredentialStatus[] }> {
    if (!bridge) throw new Error("Credential storage is only available in the desktop app");
    return bridge.credentials.list() as Promise<{ credentials: CredentialStatus[] }>;
}

export async function setCredential(name: string, value: string): Promise<{ credentials: CredentialStatus[] }> {
    if (!bridge) throw new Error("Credential storage is only available in the desktop app");
    return bridge.credentials.set(name, value) as Promise<{ credentials: CredentialStatus[] }>;
}

export async function removeCredential(name: string): Promise<{ credentials: CredentialStatus[] }> {
    if (!bridge) throw new Error("Credential storage is only available in the desktop app");
    return bridge.credentials.remove(name) as Promise<{ credentials: CredentialStatus[] }>;
}

export async function fetchBackendStatus(): Promise<BackendStatus> {
    if (bridge) {
        return bridge.backend.status() as Promise<BackendStatus>;
    }
    await http("GET", "/health");
    return {
        state: "attached",
        url: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
        error: null,
        external: true,
        encryptionAvailable: false,
    };
}

export async function checkHealth(): Promise<boolean> {
    try {
        const status = await fetchBackendStatus();
        return status.state === "running" || status.state === "attached";
    } catch {
        return false;
    }
}
