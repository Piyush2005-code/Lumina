import { randomUUID } from "node:crypto";

import { all, one, run, text, integer, boolean, json, optionalInteger, optionalText } from "../db/Database.js";

import type { Row } from "../db/Database.js";
import type { ExecutionPolicy } from "./Tool.js";
import type { ToolInvocationView } from "../types/Chat.js";

/**
 * The lifecycle of one tool call, persisted.
 *
 *   PROPOSED ──(read-only)──────────────> EXECUTING ──> COMPLETED | FAILED
 *      │
 *      └──(side-effecting)──> AWAITING_APPROVAL ──approve──> APPROVED ──> EXECUTING ──> COMPLETED | FAILED
 *                                     │
 *                                     └──reject──> REJECTED
 *
 * DENIED is separate from REJECTED: a human rejects, the policy engine denies.
 * Both are terminal, but conflating them would lose the distinction between
 * "you said no" and "you were never asked because the call was malformed".
 */
export type ToolExecutionStatus =
    | "PROPOSED"
    | "AWAITING_APPROVAL"
    | "APPROVED"
    | "EXECUTING"
    | "COMPLETED"
    | "FAILED"
    | "REJECTED"
    | "DENIED"
    | "CANCELLED";

export interface ToolExecutionRecord {
    id: string;
    conversationId: string;
    /** The provider-assigned id of the tool call this row fulfils. */
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    policy: ExecutionPolicy;
    status: ToolExecutionStatus;
    result: string | undefined;
    isError: boolean;
    ms: number | undefined;
    createdAt: number;
    completedAt: number | undefined;
}

export class ToolExecutionStore {

    create(input: {
        conversationId: string;
        toolCallId: string;
        toolName: string;
        arguments: Record<string, unknown>;
        policy: ExecutionPolicy;
    }): ToolExecutionRecord {

        const record: ToolExecutionRecord = {
            id: randomUUID(),
            conversationId: input.conversationId,
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            arguments: input.arguments,
            policy: input.policy,
            status: "PROPOSED",
            result: undefined,
            isError: false,
            ms: undefined,
            createdAt: Date.now(),
            completedAt: undefined,
        };

        run(
            `INSERT INTO tool_executions
                (id, conversation_id, tool_call_id, tool_name, arguments, policy, status, is_error, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            record.id,
            record.conversationId,
            record.toolCallId,
            record.toolName,
            JSON.stringify(record.arguments),
            record.policy,
            record.status,
            record.createdAt,
        );

        return record;
    }

    setStatus(id: string, status: ToolExecutionStatus): void {
        run(`UPDATE tool_executions SET status = ? WHERE id = ?`, status, id);
    }

    finish(id: string, status: ToolExecutionStatus, result: string, isError: boolean, ms: number): void {
        run(
            `UPDATE tool_executions SET status = ?, result = ?, is_error = ?, ms = ?, completed_at = ? WHERE id = ?`,
            status, result, isError ? 1 : 0, Math.round(ms), Date.now(), id,
        );
    }

    get(id: string): ToolExecutionRecord | undefined {
        const row = one(`SELECT * FROM tool_executions WHERE id = ?`, id);
        return row ? toRecord(row) : undefined;
    }

    forConversation(conversationId: string): ToolExecutionRecord[] {
        return all(
            `SELECT * FROM tool_executions WHERE conversation_id = ? ORDER BY created_at ASC`,
            conversationId,
        ).map(toRecord);
    }

    /** Calls that were proposed but never resolved — what a resumed turn has to finish. */
    unresolved(conversationId: string): ToolExecutionRecord[] {
        return all(
            `SELECT * FROM tool_executions
              WHERE conversation_id = ? AND status IN ('PROPOSED', 'AWAITING_APPROVAL', 'APPROVED')
              ORDER BY created_at ASC`,
            conversationId,
        ).map(toRecord);
    }
}

function toRecord(row: Row): ToolExecutionRecord {
    return {
        id: text(row, "id"),
        conversationId: text(row, "conversation_id"),
        toolCallId: text(row, "tool_call_id"),
        toolName: text(row, "tool_name"),
        arguments: json<Record<string, unknown>>(row, "arguments", {}),
        policy: text(row, "policy") as ExecutionPolicy,
        status: text(row, "status") as ToolExecutionStatus,
        result: optionalText(row, "result"),
        isError: boolean(row, "is_error"),
        ms: optionalInteger(row, "ms"),
        createdAt: integer(row, "created_at"),
        completedAt: optionalInteger(row, "completed_at"),
    };
}

export function toInvocationView(record: ToolExecutionRecord): ToolInvocationView {
    return {
        id: record.id,
        name: record.toolName,
        arguments: record.arguments,
        status: record.status,
        policy: record.policy,
        ...(record.result !== undefined ? { result: record.result } : {}),
        ...(record.isError ? { isError: true } : {}),
        ...(record.ms !== undefined ? { ms: record.ms } : {}),
    };
}

export const toolExecutionStore = new ToolExecutionStore();
