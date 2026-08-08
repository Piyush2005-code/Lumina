import { hasCredential } from "../config/env.js";
import { MODEL_CATALOGUE } from "./capabilities.js";

import type { Provider } from "./Provider.js";
import type { ModelDescriptor } from "./capabilities.js";

/**
 * A provider the runtime knows how to build, plus what it needs to be usable.
 * `create` is not called until something actually routes to this provider, so
 * an unconfigured provider never throws at import time.
 */
export interface ProviderRegistration {
    id: string;
    label: string;
    /** Environment credentials that must all be present for this provider to be usable. */
    credentials: string[];
    create: () => Provider;
}

export class ProviderNotRegisteredError extends Error {
    constructor(id: string, known: string[]) {
        super(`Unknown provider "${id}". Registered: ${known.join(", ") || "none"}`);
        this.name = "ProviderNotRegisteredError";
    }
}

export class ProviderNotConfiguredError extends Error {
    constructor(id: string, missing: string[]) {
        super(`Provider "${id}" is registered but not configured — missing ${missing.join(", ")}`);
        this.name = "ProviderNotConfiguredError";
    }
}

/**
 * The single place that knows which providers exist.
 *
 * Nothing downstream branches on a provider name: the runtime asks the scheduler
 * for a model, the scheduler asks the registry which models are currently usable,
 * and the registry hands back an object satisfying the Provider contract. Adding
 * a fifth provider is a `register()` call and a catalogue entry — no edits to the
 * runtime, the scheduler, or any route.
 */
export class ProviderRegistry {

    private readonly registrations = new Map<string, ProviderRegistration>();

    /** Instances are cached — building an SDK client per request is pure waste. */
    private readonly instances = new Map<string, Provider>();

    register(registration: ProviderRegistration): this {
        this.registrations.set(registration.id, registration);
        return this;
    }

    ids(): string[] {
        return [...this.registrations.keys()];
    }

    /** Every registered provider whose credentials are all present right now. */
    configured(): string[] {
        return this.ids().filter(id => this.missingCredentials(id).length === 0);
    }

    isConfigured(id: string): boolean {
        return this.registrations.has(id) && this.missingCredentials(id).length === 0;
    }

    missingCredentials(id: string): string[] {
        const registration = this.registrations.get(id);
        if (!registration) {
            return [];
        }
        return registration.credentials.filter(name => !hasCredential(name));
    }

    label(id: string): string {
        return this.registrations.get(id)?.label ?? id;
    }

    get(id: string): Provider {

        const registration = this.registrations.get(id);

        if (!registration) {
            throw new ProviderNotRegisteredError(id, this.ids());
        }

        const missing = this.missingCredentials(id);

        if (missing.length > 0) {
            throw new ProviderNotConfiguredError(id, missing);
        }

        const cached = this.instances.get(id);

        if (cached) {
            return cached;
        }

        const instance = registration.create();
        this.instances.set(id, instance);

        return instance;
    }

    /** Drops cached instances so newly-supplied credentials take effect without a restart. */
    invalidate(): void {
        this.instances.clear();
    }

    /* ── Model catalogue ─────────────────────────────────────────────── */

    /** Every model belonging to a registered provider. */
    models(): ModelDescriptor[] {
        return MODEL_CATALOGUE.filter(model => this.registrations.has(model.providerId));
    }

    /** Every model that could actually be called right now. */
    availableModels(): ModelDescriptor[] {
        return this.models().filter(model => this.isConfigured(model.providerId));
    }

    modelsFor(providerId: string): ModelDescriptor[] {
        return this.models().filter(model => model.providerId === providerId);
    }

    findModel(modelId: string, providerId?: string): ModelDescriptor | undefined {
        return this.models().find(model =>
            model.id === modelId && (providerId === undefined || model.providerId === providerId)
        );
    }

    defaultModelFor(providerId: string): ModelDescriptor | undefined {
        const models = this.modelsFor(providerId);
        // The catalogue is authored best-first per provider.
        return models[0];
    }
}

/** Process-wide registry. Populated once in `config/providers.ts`. */
export const providerRegistry = new ProviderRegistry();
