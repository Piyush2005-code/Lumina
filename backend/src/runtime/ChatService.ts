import { conversationStore } from "./ConversationStore.js";
import { agentRuntime } from "./AgentRuntime.js";
import { approvalStore } from "../approvals/ApprovalStore.js";

import type { ChatRequest, ChatResponse, RoutingPreference } from "../types/Chat.js";
import type { TurnOptions } from "./AgentRuntime.js";

const PREFERENCES: RoutingPreference[] = ["speed", "quality", "cost", "balanced"];

export class BadChatRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BadChatRequestError";
    }
}

/**
 * The seam between HTTP and the agent.
 *
 * Its whole job is to turn an untrusted request body into a validated turn and
 * hand it to the runtime. The route below it does no orchestration, and the
 * runtime above it never sees a raw request — which is what lets the same runtime
 * be driven later by a scheduler, a CLI, or another agent without touching Express.
 */
export class ChatService {

    async send(body: unknown): Promise<ChatResponse> {

        const request = parseChatRequest(body);

        const conversationId = request.conversationId ?? conversationStore.create();

        if (!conversationStore.exists(conversationId)) {
            throw new BadChatRequestError(`Unknown conversation ${conversationId}`);
        }

        // A new message while approvals are outstanding means the user moved on.
        // Leaving them pending would let a stale click fire a side effect later.
        approvalStore.cancelPending(conversationId);

        return agentRuntime.startTurn(conversationId, request.message, toTurnOptions(request));
    }

    /** Picks a suspended turn back up once its approvals have been decided. */
    async resume(conversationId: string, body: unknown): Promise<ChatResponse> {

        if (!conversationStore.exists(conversationId)) {
            throw new BadChatRequestError(`Unknown conversation ${conversationId}`);
        }

        const options = toTurnOptions(parsePartialRequest(body));

        return agentRuntime.continueTurn(conversationId, options);
    }

    history(conversationId: string) {
        if (!conversationStore.exists(conversationId)) {
            throw new BadChatRequestError(`Unknown conversation ${conversationId}`);
        }
        return {
            conversationId,
            messages: conversationStore.messages(conversationId),
        };
    }

    conversations() {
        return { conversations: conversationStore.list() };
    }
}

function toTurnOptions(request: Partial<ChatRequest>): TurnOptions {
    return {
        preference: request.preference ?? "balanced",
        preferredProvider: request.provider,
        preferredModel: request.model,
        require: request.require,
    };
}

function asRecord(body: unknown): Record<string, unknown> {
    if (typeof body !== "object" || body === null) {
        throw new BadChatRequestError("Request body must be a JSON object");
    }
    return body as Record<string, unknown>;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") {
        throw new BadChatRequestError(`"${key}" must be a string`);
    }
    return value;
}

function parsePreference(record: Record<string, unknown>): RoutingPreference | undefined {
    const value = optionalString(record, "preference");
    if (value === undefined) return undefined;
    if (!PREFERENCES.includes(value as RoutingPreference)) {
        throw new BadChatRequestError(`"preference" must be one of ${PREFERENCES.join(", ")}`);
    }
    return value as RoutingPreference;
}

function parseRequire(record: Record<string, unknown>): Partial<ChatRequest["require"]> | undefined {
    const value = record["require"];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object") {
        throw new BadChatRequestError(`"require" must be an object`);
    }
    return value as Partial<ChatRequest["require"]>;
}

function parsePartialRequest(body: unknown): Partial<ChatRequest> {

    const record = body === undefined || body === null ? {} : asRecord(body);

    const parsed: Partial<ChatRequest> = {};

    const provider = optionalString(record, "provider");
    if (provider !== undefined) parsed.provider = provider;

    const model = optionalString(record, "model");
    if (model !== undefined) parsed.model = model;

    const preference = parsePreference(record);
    if (preference !== undefined) parsed.preference = preference;

    const require = parseRequire(record);
    if (require !== undefined) parsed.require = require;

    return parsed;
}

function parseChatRequest(body: unknown): ChatRequest {

    const record = asRecord(body);
    const message = optionalString(record, "message");

    if (message === undefined || message.trim().length === 0) {
        throw new BadChatRequestError(`"message" is required`);
    }

    const partial = parsePartialRequest(record);
    const conversationId = optionalString(record, "conversationId");

    return {
        message,
        ...(conversationId !== undefined ? { conversationId } : {}),
        ...partial,
    };
}

export const chatService = new ChatService();
