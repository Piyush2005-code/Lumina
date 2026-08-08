import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { createLogger } from "../utils/logger.js";

import type { StatementSync } from "node:sqlite";

const log = createLogger("db");

/**
 * Conversations, tool executions, approvals and provider telemetry all have to
 * outlive the process: an approval that vanishes on restart is not an approval,
 * and a scheduler that forgets every measurement on restart is not telemetry-driven.
 *
 * node:sqlite ships with Node (>= 22.5), so persistence costs no native dependency
 * and no rebuild step when the same code is loaded inside Electron.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;

/** One row as SQLite returns it, before it is narrowed into a domain object. */
export type Row = Record<string, SqlValue>;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
    id           TEXT PRIMARY KEY,
    title        TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq             INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    -- assistant turns: JSON array of ToolCallRequest. tool turns: the originating call id/name.
    tool_calls      TEXT,
    tool_call_id    TEXT,
    tool_name       TEXT,
    created_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_seq ON messages(conversation_id, seq);

CREATE TABLE IF NOT EXISTS tool_executions (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tool_call_id    TEXT NOT NULL,
    tool_name       TEXT NOT NULL,
    arguments       TEXT NOT NULL,
    policy          TEXT NOT NULL,
    status          TEXT NOT NULL,
    result          TEXT,
    is_error        INTEGER NOT NULL DEFAULT 0,
    ms              INTEGER,
    created_at      INTEGER NOT NULL,
    completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tool_exec_conversation ON tool_executions(conversation_id);

CREATE TABLE IF NOT EXISTS approvals (
    id                TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tool_execution_id TEXT NOT NULL REFERENCES tool_executions(id) ON DELETE CASCADE,
    tool_name         TEXT NOT NULL,
    arguments         TEXT NOT NULL,
    -- Binds the decision to the exact arguments that were shown to the human.
    args_hash         TEXT NOT NULL,
    reason            TEXT NOT NULL,
    status            TEXT NOT NULL,
    created_at        INTEGER NOT NULL,
    expires_at        INTEGER NOT NULL,
    decided_at        INTEGER,
    decided_by        TEXT,
    consumed_at       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_conversation ON approvals(conversation_id);

CREATE TABLE IF NOT EXISTS provider_metrics (
    id                TEXT PRIMARY KEY,
    request_id        TEXT NOT NULL,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    latency_ms        INTEGER NOT NULL,
    ok                INTEGER NOT NULL,
    error_kind        TEXT,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_lookup ON provider_metrics(provider, model, created_at);
`;

function defaultDatabasePath(): string {
    const configured = process.env.LUMINA_DB_PATH;
    if (configured && configured.length > 0) {
        return configured;
    }
    // Electron passes LUMINA_DATA_DIR (its userData path) when it spawns the backend.
    const dataDir = process.env.LUMINA_DATA_DIR ?? path.join(os.homedir(), ".lumina");
    return path.join(dataDir, "lumina.db");
}

let instance: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {

    if (instance) {
        return instance;
    }

    const file = defaultDatabasePath();

    fs.mkdirSync(path.dirname(file), { recursive: true });

    try {
        instance = new DatabaseSync(file);
    } catch (error) {
        // node:sqlite landed in Node 22.5. An older runtime fails here rather than
        // somewhere confusing three layers down, so say so plainly.
        throw new Error(
            `Could not open the Lumina database at ${file}. ` +
            `Lumina needs Node >= 22.5 for its built-in SQLite. Running ${process.version}. ` +
            `Underlying error: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    instance.exec(SCHEMA);

    log.info("database ready", { file });

    return instance;
}

/** Prepared statements are cached per SQL string — they are reused across requests. */
const statementCache = new Map<string, StatementSync>();

export function prepare(sql: string): StatementSync {
    const cached = statementCache.get(sql);
    if (cached) {
        return cached;
    }
    const statement = getDatabase().prepare(sql);
    statementCache.set(sql, statement);
    return statement;
}

export function run(sql: string, ...params: SqlValue[]): void {
    prepare(sql).run(...params);
}

export function all(sql: string, ...params: SqlValue[]): Row[] {
    return prepare(sql).all(...params) as Row[];
}

export function one(sql: string, ...params: SqlValue[]): Row | undefined {
    return prepare(sql).get(...params) as Row | undefined;
}

/* ─── Row readers ───────────────────────────────────────────────────────────
 * SQLite hands back loosely-typed values; these narrow them once, at the edge,
 * so no repository has to litter itself with casts.
 */

export function text(row: Row, column: string): string {
    const value = row[column];
    return typeof value === "string" ? value : "";
}

export function optionalText(row: Row, column: string): string | undefined {
    const value = row[column];
    return typeof value === "string" ? value : undefined;
}

export function integer(row: Row, column: string): number {
    const value = row[column];
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    return 0;
}

export function optionalInteger(row: Row, column: string): number | undefined {
    const value = row[column];
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    return undefined;
}

export function boolean(row: Row, column: string): boolean {
    return integer(row, column) !== 0;
}

/** Parses a JSON column, falling back to `fallback` rather than throwing on corrupt data. */
export function json<T>(row: Row, column: string, fallback: T): T {
    const value = row[column];
    if (typeof value !== "string") return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}
