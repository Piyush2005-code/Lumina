import { providerRegistry } from "../providers/ProviderRegistry.js";
import { telemetryStore } from "../telemetry/TelemetryStore.js";
import { normalizeProviderError, withTimeout, ProviderError } from "../providers/ProviderError.js";
import { PROVIDER_TIMEOUT_MS } from "../config/constants.js";
import { cooldowns } from "./Cooldowns.js";
import { createLogger } from "../utils/logger.js";

import type { GenerateRequest, GenerateResponse } from "../providers/Provider.js";
import type { RoutePlan } from "./Scheduler.js";
import type { FailoverView } from "../types/Chat.js";
import type { Logger } from "../utils/logger.js";

const log = createLogger("router");

export interface InferenceResult {
    response: GenerateResponse;
    providerId: string;
    model: string;
    /** Duration of the call that succeeded. */
    ms: number;
    /** Time across every attempt, failures included — what the user actually waited for. */
    elapsedMs: number;
    failovers: FailoverView[];
}

/**
 * Executes a route plan, walking the scheduler's ranking until one model answers.
 *
 * Two rules make this behave: every attempt is measured (so the next plan is
 * better informed than this one), and only failures that would *not* recur
 * elsewhere trigger a failover. A bad API key or a malformed request fails
 * identically on every provider, so retrying it just hides the bug.
 */
export class InferenceRouter {

    async run(
        plan: RoutePlan,
        requestId: string,
        build: (model: string) => GenerateRequest,
        requestLog: Logger = log,
    ): Promise<InferenceResult> {

        if (plan.candidates.length === 0) {
            throw new ProviderError(
                "not_found",
                "none",
                "none",
                `No model can serve this request. ${plan.rationale}`,
            );
        }

        const failovers: FailoverView[] = [];
        let lastError: ProviderError | undefined;
        let elapsedMs = 0;

        for (let index = 0; index < plan.candidates.length; index++) {

            const candidate = plan.candidates[index];
            if (!candidate) continue;

            const { providerId } = candidate;
            const model = candidate.model.id;
            const next = plan.candidates[index + 1];

            let provider;

            try {
                provider = providerRegistry.get(providerId);
            } catch (error) {
                // Unconfigured or unknown — the scheduler already filters these, so
                // reaching here means credentials changed mid-flight. Not a failover event.
                lastError = normalizeProviderError(error, providerId, model);
                continue;
            }

            const start = performance.now();

            try {

                const response = await withTimeout(
                    provider.generate(build(model)),
                    PROVIDER_TIMEOUT_MS,
                    providerId,
                    model,
                );

                const ms = performance.now() - start;
                elapsedMs += ms;

                telemetryStore.record({
                    requestId,
                    provider: providerId,
                    model,
                    latencyMs: ms,
                    ok: true,
                    errorKind: null,
                    usage: response.usage,
                });

                return { response, providerId, model, ms, elapsedMs, failovers };

            } catch (error) {

                const ms = performance.now() - start;
                elapsedMs += ms;

                const normalized = normalizeProviderError(error, providerId, model);

                telemetryStore.record({
                    requestId,
                    provider: providerId,
                    model,
                    latencyMs: ms,
                    ok: false,
                    errorKind: normalized.kind,
                    usage: { promptTokens: null, completionTokens: null },
                });

                lastError = normalized;

                if (normalized.kind === "rate_limit") {
                    cooldowns.start(providerId, normalized.retryAfterMs);
                }

                if (!normalized.failoverable) {
                    throw normalized;
                }

                requestLog.warn("provider unusable", {
                    provider: providerId,
                    model,
                    kind: normalized.kind,
                    ms: Math.round(ms),
                    next: next ? `${next.providerId}/${next.model.id}` : "none",
                });

                if (next) {
                    failovers.push({
                        from: `${providerId}/${model}`,
                        to: `${next.providerId}/${next.model.id}`,
                        reason: normalized.kind,
                        detail: normalized.message.slice(0, 200),
                    });
                }
            }
        }

        throw lastError ?? new ProviderError(
            "unknown",
            "none",
            "none",
            "Every candidate model failed without reporting an error.",
        );
    }
}

export const inferenceRouter = new InferenceRouter();

export type { GenerateResponse };
