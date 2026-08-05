import { performance } from "node:perf_hooks";

import { env } from "../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/** Structured key/value context appended to a log line. `undefined` values are dropped. */
export type LogFields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

const LEVEL_COLOR: Record<Exclude<LogLevel, "silent">, string> = {
    debug: "90",
    info: "36",
    warn: "33",
    error: "31",
};

const COLOR_ENABLED = process.stdout.isTTY === true;

/** Longest a single stringified field value may get before it is clipped. */
const MAX_FIELD_LENGTH = 300;

const threshold = LEVEL_WEIGHT[parseLevel(env.LOG_LEVEL)];

/**
 * Minimal dependency-free structured logger. Scopes nest (`chat` -> `chat:a1b2c3d4`)
 * so every line of one chat request can be grepped by its id.
 */
export class Logger {

    constructor(private readonly scope: string) {}

    /** Derives a narrower scope, e.g. `createLogger("chat").child(requestId)`. */
    child(scope: string): Logger {
        return new Logger(`${this.scope}:${scope}`);
    }

    debug(message: string, fields?: LogFields): void {
        this.write("debug", message, fields);
    }

    info(message: string, fields?: LogFields): void {
        this.write("info", message, fields);
    }

    warn(message: string, fields?: LogFields): void {
        this.write("warn", message, fields);
    }

    error(message: string, fields?: LogFields): void {
        this.write("error", message, fields);
    }

    /** Logs an error with its message folded into the fields, plus a stack trace at debug level. */
    fail(message: string, error: unknown, fields?: LogFields): void {
        this.write("error", message, { ...fields, error: describeError(error) });

        if (error instanceof Error && error.stack && threshold <= LEVEL_WEIGHT.debug) {
            console.error(error.stack);
        }
    }

    private write(level: Exclude<LogLevel, "silent">, message: string, fields?: LogFields): void {

        if (LEVEL_WEIGHT[level] < threshold) {
            return;
        }

        const line = [
            paint("90", timestamp()),
            paint(LEVEL_COLOR[level], level.toUpperCase().padEnd(5)),
            paint("35", `[${this.scope}]`),
            message + formatFields(fields),
        ].join(" ");

        if (level === "error") {
            console.error(line);
        } else if (level === "warn") {
            console.warn(line);
        } else {
            console.log(line);
        }

    }

}

export function createLogger(scope: string): Logger {
    return new Logger(scope);
}

/**
 * Starts a stopwatch; the returned function reports elapsed whole milliseconds.
 * Used to attach `ms=` to the line that closes an operation.
 */
export function startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
}

/** Collapses whitespace and clips, so long prompts/tool payloads stay one readable line. */
export function preview(value: unknown, max = 120): string {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
    const collapsed = text.replace(/\s+/g, " ").trim();

    return collapsed.length > max ? `${collapsed.slice(0, max)}…(+${collapsed.length - max})` : collapsed;
}

export function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function parseLevel(raw: string | undefined): LogLevel {
    const value = raw?.toLowerCase();
    return value !== undefined && value in LEVEL_WEIGHT ? value as LogLevel : "info";
}

function timestamp(): string {
    return new Date().toISOString().slice(11, 23);
}

function formatFields(fields: LogFields | undefined): string {

    if (!fields) {
        return "";
    }

    const pairs = Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${formatValue(value)}`);

    return pairs.length > 0 ? paint("90", `  ${pairs.join(" ")}`) : "";
}

function formatValue(value: unknown): string {

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    const text = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
    const clipped = text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}…` : text;

    return /[\s"]/.test(clipped) ? JSON.stringify(clipped) : clipped;
}

function paint(color: string, text: string): string {
    return COLOR_ENABLED ? `\u001b[${color}m${text}\u001b[0m` : text;
}
