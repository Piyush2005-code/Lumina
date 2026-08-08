export interface ToolCallRequest {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export type ChatMessage =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string; toolCalls?: ToolCallRequest[] }
    | { role: "tool"; toolCallId: string; toolName: string; content: string };

/** What a task needs from a model. The scheduler treats these as hard filters. */
export interface CapabilityRequirements {
    tools: boolean;
    vision: boolean;
    streaming: boolean;
    /** Estimated tokens the request will occupy; models with a smaller window are excluded. */
    minContext: number;
}

/** What the caller wants optimised once the hard filters have been applied. */
export type RoutingPreference = "speed" | "quality" | "cost" | "balanced";

export interface ChatRequest {
    message: string;
    /** Continue an existing conversation. Omit to start a new one. */
    conversationId?: string;
    /** A hint, not a command — the scheduler may route elsewhere if this provider cannot serve the task. */
    provider?: string;
    model?: string;
    preference?: RoutingPreference;
    /** Explicitly demand capabilities the message alone would not imply. */
    require?: Partial<CapabilityRequirements>;
}

export interface ToolInvocationView {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: string;
    policy: string;
    result?: string;
    isError?: boolean;
    ms?: number;
}

export interface ApprovalView {
    id: string;
    conversationId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    status: string;
    reason: string;
    createdAt: number;
    expiresAt: number;
}

export interface FailoverView {
    from: string;
    to: string;
    reason: string;
    detail: string;
}

export type ChatStatus = "complete" | "awaiting_approval";

export interface ChatResponse {
    status: ChatStatus;
    conversationId: string;
    response: string;
    provider: string;
    model: string;
    /** Every tool the turn invoked, in order, including ones still awaiting approval. */
    toolCalls: ToolInvocationView[];
    /** Populated when status is "awaiting_approval" — the turn is paused until these are decided. */
    pendingApprovals: ApprovalView[];
    routing: {
        preference: RoutingPreference;
        requirements: CapabilityRequirements;
        /** Why this model was chosen over the alternatives. */
        rationale: string;
        failovers: FailoverView[];
        ms: number;
    };
}
