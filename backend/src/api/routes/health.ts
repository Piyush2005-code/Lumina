import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
    res.status(200).json({
        status: "ok",
        service: "Lumina Backend",
    });
});

export default router;