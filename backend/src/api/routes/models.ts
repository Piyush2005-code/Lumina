import { Router } from "express";

import { providerRegistry } from "../../providers/ProviderRegistry.js";

/**
 * GET /models
 *
 * The catalogue, grouped by provider, with each model's capabilities and whether
 * it is usable right now. The frontend renders a selector from this; the
 * scheduler reads the same catalogue to decide what can serve a task, so the two
 * can never disagree about what a model can do.
 */

const router = Router();

router.get("/", (_req, res) => {

    const providers = providerRegistry.ids().map(id => ({
        id,
        name: providerRegistry.label(id),
        configured: providerRegistry.isConfigured(id),
        missingCredentials: providerRegistry.missingCredentials(id),
        defaultModel: providerRegistry.defaultModelFor(id)?.id ?? null,
        models: providerRegistry.modelsFor(id).map(model => ({
            id: model.id,
            name: model.name,
            description: model.description,
            capabilities: model.capabilities,
        })),
    }));

    res.json({ providers });
});

export default router;
