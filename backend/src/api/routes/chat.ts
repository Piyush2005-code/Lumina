import { Router } from "express";

import { chatService, BadChatRequestError } from "../../runtime/ChatService.js";
import { ProviderError } from "../../providers/ProviderError.js";
import { createLogger, startTimer } from "../../utils/logger.js";

const router = Router();
const log = createLogger("http");

/** POST /chat — start or continue a conversation with a new user message. */
router.post("/", async (req, res) => {
    const timer = startTimer();
    try {
        const response = await chatService.send(req.body);
        log.info(`POST /chat 200`, { ms: timer(), status: response.status });
        res.json(response);
    } catch (error) {
        respondWithError(res, error, timer());
    }
});

/** POST /chat/:id/continue — resume a turn that stopped for approval. */
router.post("/:id/continue", async (req, res) => {
    const timer = startTimer();
    try {
        const response = await chatService.resume(req.params.id, req.body);
        log.info(`POST /chat/:id/continue 200`, { ms: timer(), status: response.status });
        res.json(response);
    } catch (error) {
        respondWithError(res, error, timer());
    }
});

/** GET /chat/conversations — every stored conversation, most recent first. */
router.get("/conversations", (_req, res) => {
    res.json(chatService.conversations());
});

/** GET /chat/:id — the full transcript of one conversation. */
router.get("/:id", (req, res) => {
    try {
        res.json(chatService.history(req.params.id));
    } catch (error) {
        respondWithError(res, error, 0);
    }
});

function respondWithError(res: Parameters<Parameters<typeof router.post>[1]>[1], error: unknown, ms: number): void {

    if (error instanceof BadChatRequestError) {
        log.warn("bad chat request", { ms, error: error.message });
        res.status(400).json({ error: error.message });
        return;
    }

    if (error instanceof ProviderError) {
        log.fail("provider error", error, { ms, kind: error.kind, provider: error.provider });
        res.status(error.httpStatus).json({
            error: error.message,
            kind: error.kind,
            provider: error.provider,
            model: error.model,
        });
        return;
    }

    log.fail("chat failed", error, { ms });
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
}

export default router;
