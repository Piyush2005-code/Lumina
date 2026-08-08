import { randomUUID } from "node:crypto";

import { all, one, run, text, integer, json, optionalText } from "../db/Database.js";
import { APPROVAL_TTL_MS } from "../config/constants.js";
import { hashArguments } from "./canonical.js";
import { createLogger } from "../utils/logger.js";

import type { Row } from "../db/Database.js";
import type { ApprovalView } from "../types/Chat.js";

const log = createLogger("approval");

/**
 * The human-in-the-loop state machine.
 *
 *     WAITING_FOR_APPROVAL --approve--> APPROVED --execute--> CONSUMED
 *              |
 *              |--reject---> REJECTED
 *              \--timeout--> EXPIRED
 *
 * Two properties make this an authorisation mechanism rather than a UI gesture:
 *
 *   1. The record lives in the database, not in the client. The frontend cannot
 *      send `{approved: true}` — it sends an approval id, and the backend decides
 *      what that id is worth.
 *   2. The decision is bound to a hash of the exact arguments that were shown to
 *      the human, re-checked at execution time. Approving a draft to alice does
 *      not authorise sending it to bob.
 *
 * Approvals are single-use: consuming one moves it to CONSUMED, so a replayed
 * request cannot re-run a side effect that already happened.
 */

export type ApprovalStatus =
    | "WAITING_FOR_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED"
    | "CONSUMED";

export interface ApprovalRecord {
    id: string;
    conversationId: string;
    toolExecutionId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    argsHash: string;
    reason: string;
    status: ApprovalStatus;
    createdAt: number;
    expiresAt: number;
    decidedAt: number | undefined;
    decidedBy: string | undefined;
}

export type VerifyResult =
    | { ok: true; record: ApprovalRecord }
    | { ok: false; reason: string };

export class ApprovalStore {

    create(input: {
        conversationId: string;
        toolExecutionId: string;
        toolName: string;
        arguments: Record<string, unknown>;
        reason: string;
    }): ApprovalRecord {

        const now = Date.now();

        const record: ApprovalRecord = {
            id: randomUUID(),
            conversationId: input.conversationId,
            toolExecutionId: input.toolExecutionId,
            toolName: input.toolName,
            arguments: input.arguments,
            argsHash: hashArguments(input.toolName, input.arguments),
            reason: input.reason,
            status: "WAITING_FOR_APPROVAL",
            createdAt: now,
            expiresAt: now + APPROVAL_TTL_MS,
            decidedAt: undefined,
            decidedBy: undefined,
        };

        run(
            `INSERT INTO approvals
                (id, conversation_id, tool_execution_id, tool_name, arguments, args_hash, reason, status, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            record.id,
            record.conversationId,
            record.toolExecutionId,
            record.toolName,
            JSON.stringify(record.arguments),
            record.argsHash,
            record.reason,
            record.status,
            record.createdAt,
            record.expiresAt,
        );

        log.info("approval requested", { id: record.id, tool: record.toolName, conversation: record.conversationId });

        return record;
    }

    get(id: string): ApprovalRecord | undefined {
        const row = one(`SELECT * FROM approvals WHERE id = ?`, id);
        return row ? toRecord(row) : undefined;
    }

    /** Approvals still awaiting a human. Overdue ones are swept first. */
    pending(conversationId?: string): ApprovalRecord[] {

        this.expireOverdue();

        const rows = conversationId === undefined
            ? all(`SELECT * FROM approvals WHERE status = 'WAITING_FOR_APPROVAL' ORDER BY created_at DESC`)
            : all(
                `SELECT * FROM approvals WHERE status = 'WAITING_FOR_APPROVAL' AND conversation_id = ? ORDER BY created_at ASC`,
                conversationId,
            );

        return rows.map(toRecord);
    }

    /**
     * The approval raised for a specific tool call. A scan of recent history
     * would silently miss the decision on a long-running conversation, which
     * would leave an approved call stuck instead of executing it.
     */
    forToolExecution(toolExecutionId: string): ApprovalRecord | undefined {
        const row = one(
            `SELECT * FROM approvals WHERE tool_execution_id = ? ORDER BY created_at DESC LIMIT 1`,
            toolExecutionId,
        );
        return row ? toRecord(row) : undefined;
    }

    history(limit = 50): ApprovalRecord[] {
        return all(`SELECT * FROM approvals ORDER BY created_at DESC LIMIT ?`, limit).map(toRecord);
    }

    /**
     * Records a human decision. Only a WAITING_FOR_APPROVAL record can be decided,
     * so a double-click cannot approve something twice and an expired request
     * cannot be revived by a late click.
     */
    decide(id: string, approve: boolean, decidedBy = "user"): VerifyResult {

        this.expireOverdue();

        const record = this.get(id);

        if (!record) {
            return { ok: false, reason: `No approval with id ${id}` };
        }
        if (record.status !== "WAITING_FOR_APPROVAL") {
            return { ok: false, reason: `Approval ${id} is already ${record.status}` };
        }

        const status: ApprovalStatus = approve ? "APPROVED" : "REJECTED";
        const now = Date.now();

        run(
            `UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?
              WHERE id = ? AND status = 'WAITING_FOR_APPROVAL'`,
            status, now, decidedBy, id,
        );

        log.info("approval decided", { id, status, tool: record.toolName });

        return { ok: true, record: { ...record, status, decidedAt: now, decidedBy } };
    }

    /**
     * The check that actually guards execution. Called by the tool executor with
     * the arguments it is about to run; anything other than an approved, unexpired,
     * unconsumed, hash-matching record fails closed.
     */
    consume(id: string, toolName: string, args: Record<string, unknown>): VerifyResult {

        this.expireOverdue();

        const record = this.get(id);

        if (!record) {
            return { ok: false, reason: `No approval with id ${id}` };
        }
        if (record.status === "CONSUMED") {
            return { ok: false, reason: `Approval ${id} has already been used` };
        }
        if (record.status !== "APPROVED") {
            return { ok: false, reason: `Approval ${id} is ${record.status}, not APPROVED` };
        }
        if (Date.now() > record.expiresAt) {
            this.markExpired(id);
            return { ok: false, reason: `Approval ${id} expired before it was used` };
        }
        if (record.toolName !== toolName) {
            return { ok: false, reason: `Approval ${id} authorises ${record.toolName}, not ${toolName}` };
        }
        if (record.argsHash !== hashArguments(toolName, args)) {
            // The arguments changed between approval and execution. Refuse, loudly.
            log.error("approval argument mismatch", { id, tool: toolName });
            return { ok: false, reason: `Arguments differ from what was approved for ${id}` };
        }

        run(`UPDATE approvals SET status = 'CONSUMED', consumed_at = ? WHERE id = ?`, Date.now(), id);

        return { ok: true, record: { ...record, status: "CONSUMED" } };
    }

    /** Cancels everything still pending on a conversation, e.g. when the user abandons a turn. */
    cancelPending(conversationId: string): number {
        const pending = this.pending(conversationId);
        for (const record of pending) {
            run(
                `UPDATE approvals SET status = 'REJECTED', decided_at = ?, decided_by = 'cancelled' WHERE id = ?`,
                Date.now(), record.id,
            );
        }
        return pending.length;
    }

    private markExpired(id: string): void {
        run(`UPDATE approvals SET status = 'EXPIRED' WHERE id = ?`, id);
    }

    private expireOverdue(): void {
        run(
            `UPDATE approvals SET status = 'EXPIRED' WHERE status = 'WAITING_FOR_APPROVAL' AND expires_at < ?`,
            Date.now(),
        );
    }
}

function toRecord(row: Row): ApprovalRecord {
    return {
        id: text(row, "id"),
        conversationId: text(row, "conversation_id"),
        toolExecutionId: text(row, "tool_execution_id"),
        toolName: text(row, "tool_name"),
        arguments: json<Record<string, unknown>>(row, "arguments", {}),
        argsHash: text(row, "args_hash"),
        reason: text(row, "reason"),
        status: text(row, "status") as ApprovalStatus,
        createdAt: integer(row, "created_at"),
        expiresAt: integer(row, "expires_at"),
        decidedAt: integer(row, "decided_at") || undefined,
        decidedBy: optionalText(row, "decided_by"),
    };
}

export function toApprovalView(record: ApprovalRecord): ApprovalView {
    return {
        id: record.id,
        conversationId: record.conversationId,
        toolName: record.toolName,
        arguments: record.arguments,
        status: record.status,
        reason: record.reason,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
    };
}

export const approvalStore = new ApprovalStore();
