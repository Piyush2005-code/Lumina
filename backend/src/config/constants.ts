/** Wall-clock budget for a single provider round trip before we give up and fail over. */
export const PROVIDER_TIMEOUT_MS = 60_000;

/** Hard cap on tool-call round trips within one agent turn, so a looping agent cannot run forever. */
export const MAX_TOOL_ITERATIONS = 8;

/**
 * Messages retained when replaying a conversation into a provider. The oldest
 * turns are dropped first; tool results are kept with their originating
 * assistant turn so no provider ever sees an orphaned tool message.
 */
export const MAX_CHAT_HISTORY = 40;

/** Telemetry older than this is ignored when scoring providers — routing should track current conditions. */
export const TELEMETRY_WINDOW_MS = 60 * 60 * 1000;

/** Minimum successful samples before a provider's measured latency outranks its static prior. */
export const MIN_SAMPLES_FOR_CONFIDENCE = 3;

/** Applied when a provider reports a rate limit without a usable Retry-After. */
export const DEFAULT_COOLDOWN_MS = 15_000;

/** Never park a provider for longer than this, however large its Retry-After. */
export const MAX_COOLDOWN_MS = 120_000;

/** An approval left undecided for this long is expired and can no longer be acted on. */
export const APPROVAL_TTL_MS = 30 * 60 * 1000;

/** Rough characters-per-token used to size a request against a model's context window. */
export const CHARS_PER_TOKEN = 4;
