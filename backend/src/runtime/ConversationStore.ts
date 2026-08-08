import { randomUUID } from "node:crypto";

import { all, one, run, text, integer, json, optionalText } from "../db/Database.js";
import { MAX_CHAT_HISTORY } from "../config/constants.js";

import type { Row } from "../db/Database.js";
import type { ChatMessage, ToolCallRequest } from "../types/Chat.js";

export interface ConversationSummary {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
}

/**
 * Conversations live in the database rather than in the request body.
 *
 * That is what makes a paused turn resumable: when the runtime stops to ask for
 * approval, the transcript up to that point — including the assistant turn that
 * requested the tool — is already durable. The client resumes by sending an id,
 * not by replaying state it could have edited.
 */
export class ConversationStore {

    create(title?: string): string {

        const id = randomUUID();
        const now = Date.now();

        run(
            `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
            id, title ?? null, now, now,
        );

        return id;
    }

    exists(id: string): boolean {
        return one(`SELECT id FROM conversations WHERE id = ?`, id) !== undefined;
    }

    /** Uses the first user message as a title if none was set. */
    private ensureTitle(id: string, candidate: string): void {
        const row = one(`SELECT title FROM conversations WHERE id = ?`, id);
        if (row && optionalText(row, "title") === undefined) {
            run(`UPDATE conversations SET title = ? WHERE id = ?`, candidate.slice(0, 80), id);
        }
    }

    append(conversationId: string, message: ChatMessage): void {

        const seqRow = one(
            `SELECT COALESCE(MAX(seq), -1) + 1 AS next FROM messages WHERE conversation_id = ?`,
            conversationId,
        );

        const seq = seqRow ? integer(seqRow, "next") : 0;

        run(
            `INSERT INTO messages
                (id, conversation_id, seq, role, content, tool_calls, tool_call_id, tool_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            randomUUID(),
            conversationId,
            seq,
            message.role,
            message.content,
            message.role === "assistant" && message.toolCalls ? JSON.stringify(message.toolCalls) : null,
            message.role === "tool" ? message.toolCallId : null,
            message.role === "tool" ? message.toolName : null,
            Date.now(),
        );

        run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, Date.now(), conversationId);

        if (message.role === "user") {
            this.ensureTitle(conversationId, message.content);
        }
    }

    messages(conversationId: string): ChatMessage[] {
        return all(
            `SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq ASC`,
            conversationId,
        ).map(toMessage);
    }

    /**
     * The window actually sent to a provider.
     *
     * Trimming naively would be a bug, not an optimisation: every provider rejects
     * a tool result whose originating assistant turn is missing. So the window is
     * cut to size and then walked forward to the first turn that can legally start
     * a transcript.
     */
    window(conversationId: string, limit: number = MAX_CHAT_HISTORY): ChatMessage[] {

        const messages = this.messages(conversationId);

        if (messages.length <= limit) {
            return messages;
        }

        let start = messages.length - limit;

        while (start < messages.length) {
            const candidate = messages[start];
            if (!candidate) break;
            const orphanedToolResult = candidate.role === "tool";
            const danglingAssistant = candidate.role === "assistant" && candidate.toolCalls !== undefined;
            if (!orphanedToolResult && !danglingAssistant) break;
            start++;
        }

        return messages.slice(start);
    }

    list(limit = 50): ConversationSummary[] {
        return all(
            `SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
               FROM conversations c
               LEFT JOIN messages m ON m.conversation_id = c.id
              GROUP BY c.id
              ORDER BY c.updated_at DESC
              LIMIT ?`,
            limit,
        ).map(row => ({
            id: text(row, "id"),
            title: optionalText(row, "title") ?? "Untitled",
            createdAt: integer(row, "created_at"),
            updatedAt: integer(row, "updated_at"),
            messageCount: integer(row, "message_count"),
        }));
    }

    delete(id: string): void {
        run(`DELETE FROM conversations WHERE id = ?`, id);
    }
}

function toMessage(row: Row): ChatMessage {

    const role = text(row, "role");
    const content = text(row, "content");

    if (role === "tool") {
        return {
            role: "tool",
            toolCallId: text(row, "tool_call_id"),
            toolName: text(row, "tool_name"),
            content,
        };
    }

    if (role === "assistant") {
        const toolCalls = json<ToolCallRequest[] | null>(row, "tool_calls", null);
        return toolCalls && toolCalls.length > 0
            ? { role: "assistant", content, toolCalls }
            : { role: "assistant", content };
    }

    if (role === "system") {
        return { role: "system", content };
    }

    return { role: "user", content };
}

export const conversationStore = new ConversationStore();
