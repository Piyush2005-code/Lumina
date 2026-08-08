import { DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS } from "../config/constants.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("cooldown");

/**
 * A provider that just rate-limited us will rate-limit us again. Parking it for
 * the length of its own Retry-After stops every subsequent request from spending
 * a round trip rediscovering the same limit.
 *
 * Deliberately in-memory: a cooldown outliving the process it was measured in
 * would be stale by definition.
 */
export class CooldownRegistry {

    /** provider → epoch ms at which it becomes usable again. */
    private readonly until = new Map<string, number>();

    isCoolingDown(provider: string): boolean {
        const expiry = this.until.get(provider);
        if (expiry === undefined) return false;
        if (Date.now() >= expiry) {
            this.until.delete(provider);
            return false;
        }
        return true;
    }

    remainingMs(provider: string): number {
        const expiry = this.until.get(provider);
        if (expiry === undefined) return 0;
        return Math.max(0, expiry - Date.now());
    }

    start(provider: string, retryAfterMs?: number): void {
        const wait = Math.min(retryAfterMs ?? DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS);
        this.until.set(provider, Date.now() + wait);
        log.warn("provider cooling down", { provider, ms: wait });
    }

    clear(): void {
        this.until.clear();
    }
}

export const cooldowns = new CooldownRegistry();
