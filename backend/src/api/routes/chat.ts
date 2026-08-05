import { Router } from "express";

import { ChatHandler } from "../../chat/ChatHandler.js";
import { createLogger, startTimer } from "../../utils/logger.js";

const router = Router();

const handler = new ChatHandler();

const log = createLogger("http");

router.post("/", async (req, res) => {

    const timer = startTimer();

    try {

        const response =
            await handler.handle(req.body);

        log.info("POST /chat 200", { ms: timer() });

        res.json(response);

    }

    catch (error) {

        log.fail("POST /chat 500", error, { ms: timer() });

        res.status(500).json({

            error:
                error instanceof Error
                    ? error.message
                    : "Unknown Error"

        });

    }

});

export default router;
