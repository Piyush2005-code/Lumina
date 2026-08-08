import { createHash } from "node:crypto";

/**
 * Deterministic JSON: object keys sorted at every depth, so two structurally
 * identical argument objects always produce the same string regardless of the
 * order a provider happened to emit them in.
 */
export function canonicalize(value: unknown): string {

    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }

    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);

    return `{${entries.join(",")}}`;
}

/**
 * Binds an approval to the exact arguments a human was shown.
 *
 * Without this, "approved" would mean "approved something" — a client could
 * have a benign draft approved and then submit a different recipient. The hash
 * is checked again at execution time, so a mismatch fails closed.
 */
export function hashArguments(toolName: string, args: Record<string, unknown>): string {
    return createHash("sha256")
        .update(toolName)
        .update(" ")
        .update(canonicalize(args))
        .digest("hex");
}
