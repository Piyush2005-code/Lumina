import { Router } from "express";

import { ChatHandler } from "../../chat/ChatHandler.js";

const router = Router();

const handler = new ChatHandler();

router.post("/", async (req, res) => {

    try {

        const response =
            await handler.handle(req.body);

        res.json(response);

    }

    catch (error) {

        res.status(500).json({

            error:
                error instanceof Error
                    ? error.message
                    : "Unknown Error"

        });

    }

});

export default router;