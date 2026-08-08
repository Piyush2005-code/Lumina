import { providerRegistry } from "../providers/ProviderRegistry.js";
import { telemetryStore } from "../telemetry/TelemetryStore.js";
import { CHARS_PER_TOKEN, MIN_SAMPLES_FOR_CONFIDENCE } from "../config/constants.js";
import { cooldowns } from "./Cooldowns.js";

import type { ModelDescriptor } from "../providers/capabilities.js";
import type { ModelStats } from "../telemetry/TelemetryStore.js";
import type { CapabilityRequirements, ChatMessage, RoutingPreference } from "../types/Chat.js";

/**
 * Capability-aware routing, then telemetry-driven ranking.
 *
 * Two distinct stages, deliberately not blended:
 *
 *   1. HARD FILTER — a model that cannot call tools is not a slower choice for
 *      a tool task, it is not a choice at all. Requirements are absolute.
 *   2. SCORE — among models that *can* serve the task, rank by what has actually
 *      been measured (latency, error rate) plus static properties (cost, tier),
 *      weighted by what the caller asked to optimise.
 *
 * The scheduler is deterministic and explainable: every decision comes back with
 * the numbers behind it, which is the difference between routing and guessing.
 */

export interface ScoreBreakdown {
    latency: number;
    reliability: number;
    cost: number;
    quality: number;
    preference: number;
}

export interface RouteCandidate {
    providerId: string;
    model: ModelDescriptor;
    score: number;
    breakdown: ScoreBreakdown;
    stats: ModelStats;
    /** True when the score used measured latency rather than the static prior. */
    measured: boolean;
    coolingDown: boolean;
}

export interface RejectedCandidate {
    providerId: string;
    modelId: string;
    reason: string;
}

export interface RoutePlan {
    candidates: RouteCandidate[];
    rejected: RejectedCandidate[];
    requirements: CapabilityRequirements;
    preference: RoutingPreference;
    rationale: string;
}

export interface PlanInput {
    messages: ChatMessage[];
    toolCount: number;
    preference: RoutingPreference;
    /** Caller's hint. Honoured only if it survives the capability filter. */
    preferredProvider?: string;
    preferredModel?: string;
    require?: Partial<CapabilityRequirements>;
}

/** How much each signal matters, per stated preference. Rows sum to 1. */
const WEIGHTS: Record<RoutingPreference, ScoreBreakdown> = {
    speed:    { latency: 0.55, reliability: 0.25, cost: 0.10, quality: 0.10, preference: 0 },
    quality:  { latency: 0.15, reliability: 0.20, cost: 0.10, quality: 0.55, preference: 0 },
    cost:     { latency: 0.15, reliability: 0.20, cost: 0.55, quality: 0.10, preference: 0 },
    balanced: { latency: 0.30, reliability: 0.30, cost: 0.15, quality: 0.25, preference: 0 },
};

/**
 * Added to a candidate the caller explicitly asked for. Large enough that an
 * explicit choice usually wins, small enough that a measurably broken provider
 * still loses to a working one — a hint is not a command.
 */
const EXPLICIT_CHOICE_BONUS = 0.25;

/** A provider parked by a rate limit is not excluded, just heavily penalised. */
const COOLDOWN_PENALTY = 0.5;

/** Bounded 0..1, monotonically decreasing in `ms`. 0ms → 1.0, 1s → 0.5, 3s → 0.25. */
function latencyScore(ms: number): number {
    return 1 / (1 + ms / 1000);
}

/** Bounded 0..1, monotonically decreasing in dollars per million tokens. */
function costScore(usdPerMillion: number): number {
    return 1 / (1 + usdPerMillion / 2);
}

export class Scheduler {

    /**
     * What the task demands of a model, derived from the request itself and then
     * widened by anything the caller explicitly required.
     */
    inferRequirements(input: PlanInput): CapabilityRequirements {

        const characters = input.messages.reduce((sum, message) => sum + message.content.length, 0);

        // Tool schemas are part of the prompt, and they are not small.
        const estimatedTokens = Math.ceil(characters / CHARS_PER_TOKEN) + input.toolCount * 120;

        const inferred: CapabilityRequirements = {
            tools: input.toolCount > 0,
            vision: input.messages.some(message => looksLikeImageReference(message)),
            streaming: false,
            // Headroom for the reply and for the tool results that will be appended.
            minContext: Math.ceil(estimatedTokens * 1.5) + 2_000,
        };

        return {
            tools: input.require?.tools ?? inferred.tools,
            vision: input.require?.vision ?? inferred.vision,
            streaming: input.require?.streaming ?? inferred.streaming,
            minContext: Math.max(inferred.minContext, input.require?.minContext ?? 0),
        };
    }

    plan(input: PlanInput): RoutePlan {

        const requirements = this.inferRequirements(input);
        const weights = WEIGHTS[input.preference];

        const candidates: RouteCandidate[] = [];
        const rejected: RejectedCandidate[] = [];

        for (const model of providerRegistry.models()) {

            const unusable = this.reasonUnusable(model, requirements);

            if (unusable !== undefined) {
                rejected.push({ providerId: model.providerId, modelId: model.id, reason: unusable });
                continue;
            }

            const stats = telemetryStore.statsFor(model.providerId, model.id);
            const measured = stats.calls >= MIN_SAMPLES_FOR_CONFIDENCE && stats.p50Ms !== null;

            // Measured latency once there is enough of it; the catalogue prior until then,
            // so a model nobody has called yet is still a plausible candidate.
            const observedMs = measured && stats.p50Ms !== null ? stats.p50Ms : model.capabilities.priorLatencyMs;

            // Error rate needs samples too — one failed call out of one is not a 100% failure rate.
            const reliability = stats.calls + stats.errors >= MIN_SAMPLES_FOR_CONFIDENCE
                ? 1 - stats.errorRate
                : 0.9;

            const blendedCost = (model.capabilities.costPerMillionInput * 3 + model.capabilities.costPerMillionOutput) / 4;

            const isExplicit =
                (input.preferredModel !== undefined && input.preferredModel === model.id) ||
                (input.preferredModel === undefined && input.preferredProvider === model.providerId);

            const coolingDown = cooldowns.isCoolingDown(model.providerId);

            const breakdown: ScoreBreakdown = {
                latency: latencyScore(observedMs),
                reliability,
                cost: costScore(blendedCost),
                quality: model.capabilities.quality / 5,
                preference: isExplicit ? 1 : 0,
            };

            const score =
                weights.latency * breakdown.latency +
                weights.reliability * breakdown.reliability +
                weights.cost * breakdown.cost +
                weights.quality * breakdown.quality +
                (isExplicit ? EXPLICIT_CHOICE_BONUS : 0) -
                (coolingDown ? COOLDOWN_PENALTY : 0);

            candidates.push({
                providerId: model.providerId,
                model,
                score,
                breakdown,
                stats,
                measured,
                coolingDown,
            });
        }

        candidates.sort((a, b) => b.score - a.score);

        return {
            candidates,
            rejected,
            requirements,
            preference: input.preference,
            rationale: explain(candidates, rejected, requirements, input.preference),
        };
    }

    /** Returns why this model cannot serve the task, or undefined if it can. */
    private reasonUnusable(model: ModelDescriptor, requirements: CapabilityRequirements): string | undefined {

        if (!providerRegistry.isConfigured(model.providerId)) {
            const missing = providerRegistry.missingCredentials(model.providerId);
            return `no credentials (${missing.join(", ")})`;
        }
        if (requirements.tools && !model.capabilities.tools) {
            return "task needs tool calling";
        }
        if (requirements.vision && !model.capabilities.vision) {
            return "task needs vision";
        }
        if (requirements.streaming && !model.capabilities.streaming) {
            return "task needs streaming";
        }
        if (requirements.minContext > model.capabilities.maxContext) {
            return `context window too small (needs ~${requirements.minContext}, has ${model.capabilities.maxContext})`;
        }

        return undefined;
    }
}

/** Cheap heuristic — the message layer is text-only today, so this is a hook, not a classifier. */
function looksLikeImageReference(message: ChatMessage): boolean {
    if (message.role !== "user") return false;
    return /\b(data:image\/|\.png\b|\.jpe?g\b|\battach(ed)? image\b|\bscreenshot\b)/i.test(message.content);
}

function explain(
    candidates: RouteCandidate[],
    rejected: RejectedCandidate[],
    requirements: CapabilityRequirements,
    preference: RoutingPreference,
): string {

    const winner = candidates[0];

    if (!winner) {
        return `No model satisfies the task requirements (${describeRequirements(requirements)}). ` +
            `${rejected.length} model(s) excluded.`;
    }

    const source = winner.measured
        ? `measured p50 ${winner.stats.p50Ms}ms over ${winner.stats.calls} call(s)`
        : `no telemetry yet, using catalogue prior ${winner.model.capabilities.priorLatencyMs}ms`;

    const runnerUp = candidates[1];

    const margin = runnerUp
        ? ` Next best was ${runnerUp.model.id} at ${runnerUp.score.toFixed(3)}.`
        : " It was the only eligible model.";

    return `Optimising for ${preference}. Requirements: ${describeRequirements(requirements)}. ` +
        `${candidates.length} eligible, ${rejected.length} excluded. ` +
        `Chose ${winner.providerId}/${winner.model.id} with score ${winner.score.toFixed(3)} (${source}).${margin}`;
}

function describeRequirements(requirements: CapabilityRequirements): string {
    const parts = [`context >= ${requirements.minContext}`];
    if (requirements.tools) parts.push("tools");
    if (requirements.vision) parts.push("vision");
    if (requirements.streaming) parts.push("streaming");
    return parts.join(", ");
}

export const scheduler = new Scheduler();
