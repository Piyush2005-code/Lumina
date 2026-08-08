/**
 * Every provider SDK reports failures differently — Groq and OpenAI throw
 * typed APIErrors with a `status`, Gemini surfaces RESOURCE_EXHAUSTED inside
 * a message string. Routing and the UI both need one vocabulary, so all of it
 * is normalised into ProviderError here.
 */

export type ProviderErrorKind =
    | "rate_limit"
    | "auth"
    | "not_found"
    | "bad_request"
    | "timeout"
    | "server"
    | "network"
    | "unknown";

/** Kinds worth trying elsewhere. A bad key or a bad request fails the same way on every provider. */
const FAILOVERABLE: ReadonlySet<ProviderErrorKind> = new Set<ProviderErrorKind>([
    "rate_limit",
    "timeout",
    "server",
    "network",
]);

export class ProviderError extends Error {

    constructor(
        readonly kind: ProviderErrorKind,
        readonly provider: string,
        readonly model: string,
        message: string,
        readonly status?: number,
        readonly retryAfterMs?: number,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = "ProviderError";
    }

    /** Should the router try a different provider for this failure? */
    get failoverable(): boolean {
        return FAILOVERABLE.has(this.kind);
    }

    /** HTTP status to hand back to the client. */
    get httpStatus(): number {
        switch (this.kind) {
            case "rate_limit": return 429;
            case "auth": return 401;
            case "not_found": return 404;
            case "bad_request": return 400;
            case "timeout": return 504;
            default: return 502;
        }
    }
}

/** Thrown when a provider call exceeds the configured deadline. */
export class ProviderTimeoutError extends ProviderError {
    constructor(provider: string, model: string, ms: number) {
        super("timeout", provider, model, `${provider} did not respond within ${ms}ms`, undefined, undefined);
        this.name = "ProviderTimeoutError";
    }
}

function readStatus(error: unknown): number | undefined {

    if (typeof error !== "object" || error === null) return undefined;

    const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };

    for (const value of [candidate.status, candidate.statusCode, candidate.response?.status]) {
        if (typeof value === "number") return value;
    }

    return undefined;
}

/**
 * `retry-after` is seconds or an HTTP date. Headers may be a Headers instance
 * or a plain object depending on the SDK, so both shapes are read.
 */
function readRetryAfterMs(error: unknown): number | undefined {

    if (typeof error !== "object" || error === null) return undefined;

    const headers = (error as { headers?: unknown }).headers;
    let raw: string | undefined;

    if (headers instanceof Headers) {
        raw = headers.get("retry-after") ?? undefined;
    } else if (typeof headers === "object" && headers !== null) {
        const record = headers as Record<string, unknown>;
        const value = record["retry-after"] ?? record["Retry-After"] ?? record["x-ratelimit-reset-requests"];
        if (typeof value === "string" || typeof value === "number") raw = String(value);
    }

    if (raw === undefined) return undefined;

    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));

    const date = Date.parse(raw);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Last resort when a provider reports a limit without a usable status code. */
function kindFromMessage(message: string): ProviderErrorKind | undefined {

    const text = message.toLowerCase();

    if (text.includes("resource_exhausted") || text.includes("rate limit") || text.includes("ratelimit")
        || text.includes("too many requests") || text.includes("quota")) {
        return "rate_limit";
    }
    if (text.includes("unauthenticated") || text.includes("api key") || text.includes("permission_denied")) {
        return "auth";
    }
    if (text.includes("timeout") || text.includes("timed out") || text.includes("aborted")) {
        return "timeout";
    }
    if (text.includes("econnreset") || text.includes("enotfound") || text.includes("fetch failed")) {
        return "network";
    }

    return undefined;
}

function kindFromStatus(status: number): ProviderErrorKind {
    if (status === 429) return "rate_limit";
    if (status === 401 || status === 403) return "auth";
    if (status === 404) return "not_found";
    if (status === 408 || status === 504) return "timeout";
    if (status >= 500) return "server";
    if (status >= 400) return "bad_request";
    return "unknown";
}

export function normalizeProviderError(error: unknown, provider: string, model: string): ProviderError {

    if (error instanceof ProviderError) return error;

    const message = error instanceof Error ? error.message : String(error);
    const status = readStatus(error);

    // A status code is authoritative; fall back to message sniffing only without one.
    const kind = status !== undefined
        ? kindFromStatus(status)
        : kindFromMessage(message) ?? "unknown";

    return new ProviderError(kind, provider, model, message, status, readRetryAfterMs(error), { cause: error });
}

/** Rejects with ProviderTimeoutError if the call outlives `ms`. */
export async function withTimeout<T>(
    work: Promise<T>,
    ms: number,
    provider: string,
    model: string,
): Promise<T> {

    let timer: NodeJS.Timeout | undefined;

    try {
        return await Promise.race([
            work,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new ProviderTimeoutError(provider, model, ms)), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
