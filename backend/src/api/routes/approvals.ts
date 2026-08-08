import { Router } from "express";

import { approvalStore, toApprovalView } from "../../approvals/ApprovalStore.js";
import { createLogger } from "../../utils/logger.js";

/**
 * The human half of the human-in-the-loop.
 *
 * Note what these endpoints do *not* accept: the arguments to run. A client can
 * say "approve id X" and nothing more — the backend already holds what X
 * authorises, and re-checks it at execution time.
 */

const router = Router();
const log = createLogger("http");

/** GET /approvals — everything still waiting on a human. */
router.get("/", (req, res) => {
    const conversationId = typeof req.query.conversationId === "string" ? req.query.conversationId : undefined;
    res.json({ approvals: approvalStore.pending(conversationId).map(toApprovalView) });
});

/** GET /approvals/history — decided approvals, for auditing what was authorised and by whom. */
router.get("/history", (_req, res) => {
    res.json({
        approvals: approvalStore.history().map(record => ({
            ...toApprovalView(record),
            decidedAt: record.decidedAt ?? null,
            decidedBy: record.decidedBy ?? null,
        })),
    });
});

router.post("/:id/approve", (req, res) => {
    const result = approvalStore.decide(req.params.id, true);
    if (!result.ok) {
        log.warn("approve rejected", { id: req.params.id, reason: result.reason });
        res.status(409).json({ error: result.reason });
        return;
    }
    res.json({ approval: toApprovalView(result.record) });
});

router.post("/:id/reject", (req, res) => {
    const result = approvalStore.decide(req.params.id, false);
    if (!result.ok) {
        res.status(409).json({ error: result.reason });
        return;
    }
    res.json({ approval: toApprovalView(result.record) });
});

export default router;
