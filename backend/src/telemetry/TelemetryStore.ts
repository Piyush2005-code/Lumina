import { randomUUID } from "node:crypto";

import { all, one, run, integer, text, optionalText } from "../db/Database.js";
import { TELEMETRY_WINDOW_MS } from "../config/constants.js";

import type { TokenUsage } from "../providers/Provider.js";

/**
 * Every provider round trip is written here, and the scheduler reads the
 * aggregates back to decide where the next one goes. That loop — measure,
 * aggregate, route — is the whole point: the numbers are not a dashboard,
 * they are an input.
 *
 * Persisted rather than in-memory, so a restart doesn't reset the scheduler
 * to guessing.
 */

export interface RecordedCall {
    requestId: string;
    provider: string;
    model: string;
    latencyMs: number;
    ok: boolean;
    errorKind: string | null;
    usage: TokenUsage;
}

export interface ModelStats {
    provider: string;
    model: string;
    /** Successful calls only — failures are counted but excluded from latency percentiles. */
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
}

/** Nearest-rank percentile over an ascending array. */
function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? null;
}

export class TelemetryStore {

    record(call: RecordedCall): void {
        run(
            `INSERT INTO provider_metrics
                (id, request_id, provider, model, latency_ms, ok, error_kind, prompt_tokens, completion_tokens, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            randomUUID(),
            call.requestId,
            call.provider,
            call.model,
            Math.round(call.latencyMs),
            call.ok ? 1 : 0,
            call.errorKind,
            call.usage.promptTokens,
            call.usage.completionTokens,
            Date.now(),
        );
    }

    /**
     * Aggregates for one model over the recent window. This is the hot path for
     * routing — it runs before every turn, so it stays a single indexed query.
     */
    statsFor(provider: string, model: string, windowMs: number = TELEMETRY_WINDOW_MS): ModelStats {

        const since = Date.now() - windowMs;

        const rows = all(
            `SELECT latency_ms, ok, created_at, prompt_tokens, completion_tokens
               FROM provider_metrics
              WHERE provider = ? AND model = ? AND created_at >= ?
              ORDER BY created_at ASC`,
            provider, model, since,
        );

        return aggregate(provider, model, rows.map(row => ({
            latencyMs: integer(row, "latency_ms"),
            ok: integer(row, "ok") !== 0,
            createdAt: integer(row, "created_at"),
            promptTokens: integer(row, "prompt_tokens"),
            completionTokens: integer(row, "completion_tokens"),
        })));
    }

    snapshot(windowMs: number = TELEMETRY_WINDOW_MS): TelemetrySnapshot {

        const since = Date.now() - windowMs;

        const keys = all(
            `SELECT DISTINCT provider, model FROM provider_metrics WHERE created_at >= ?`,
            since,
        );

        const stats = keys
            .map(row => this.statsFor(text(row, "provider"), text(row, "model"), windowMs))
            // Fastest median first; models with no successful call yet sort last.
            .sort((a, b) => (a.p50Ms ?? Infinity) - (b.p50Ms ?? Infinity));

        const totals = one(
            `SELECT COUNT(*) AS calls,
                    SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS errors,
                    COALESCE(SUM(prompt_tokens), 0)     AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS completion_tokens
               FROM provider_metrics
              WHERE created_at >= ?`,
            since,
        );

        return {
            stats,
            totals: {
                providerCalls: totals ? integer(totals, "calls") : 0,
                errors: totals ? integer(totals, "errors") : 0,
                promptTokens: totals ? integer(totals, "prompt_tokens") : 0,
                completionTokens: totals ? integer(totals, "completion_tokens") : 0,
            },
            windowMs,
            since,
        };
    }

    /** Most recent failure reason for a model, shown in the UI next to a degraded provider. */
    lastErrorKind(provider: string, model: string): string | undefined {
        const row = one(
            `SELECT error_kind FROM provider_metrics
              WHERE provider = ? AND model = ? AND ok = 0
              ORDER BY created_at DESC LIMIT 1`,
            provider, model,
        );
        return row ? optionalText(row, "error_kind") : undefined;
    }

    reset(): void {
        run(`DELETE FROM provider_metrics`);
    }
}

interface Sample {
    latencyMs: number;
    ok: boolean;
    createdAt: number;
    promptTokens: number;
    completionTokens: number;
}

function aggregate(provider: string, model: string, samples: Sample[]): ModelStats {

    const ok = samples.filter(sample => sample.ok);
    const durations = ok.map(sample => sample.latencyMs).sort((a, b) => a - b);
    const last = samples[samples.length - 1];

    return {
        provider,
        model,
        calls: ok.length,
        errors: samples.length - ok.length,
        errorRate: samples.length > 0 ? (samples.length - ok.length) / samples.length : 0,
        avgMs: durations.length > 0
            ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length)
            : null,
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        minMs: durations[0] ?? null,
        maxMs: durations[durations.length - 1] ?? null,
        lastMs: last?.latencyMs ?? null,
        lastAt: last?.createdAt ?? null,
        promptTokens: samples.reduce((sum, sample) => sum + sample.promptTokens, 0),
        completionTokens: samples.reduce((sum, sample) => sum + sample.completionTokens, 0),
    };
}

export const telemetryStore = new TelemetryStore();
