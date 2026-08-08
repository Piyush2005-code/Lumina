import { Router } from "express";

import { telemetryStore } from "../../telemetry/TelemetryStore.js";
import { cooldowns } from "../../scheduler/Cooldowns.js";
import { providerRegistry } from "../../providers/ProviderRegistry.js";

/**
 * GET    /telemetry — measured latency and error rates per provider+model.
 * DELETE /telemetry — clear history and start measuring fresh.
 *
 * The scheduler reads exactly this data to rank candidates, so what the panel
 * shows is not a report on routing — it is the routing input itself.
 */

const router = Router();

router.get("/", (_req, res) => {
    const snapshot = telemetryStore.snapshot();
    res.json({
        ...snapshot,
        cooldowns: providerRegistry.ids()
            .filter(id => cooldowns.isCoolingDown(id))
            .map(id => ({ provider: id, remainingMs: cooldowns.remainingMs(id) })),
    });
});

router.delete("/", (_req, res) => {
    telemetryStore.reset();
    cooldowns.clear();
    res.json(telemetryStore.snapshot());
});

export default router;
