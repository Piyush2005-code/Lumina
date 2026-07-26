import express, { type Express } from "express";
import cors from "cors";
import healthRouter from "./api/routes/health.js";
import chatRouter from "./api/routes/chat.js";
import modelsRouter from "./api/routes/models.js";

const app: Express = express();

/*
 * Register global middleware.
 */
app.use(cors());
app.use(express.json());

/*
 * Routes.
 */
app.use("/health", healthRouter);
app.use("/chat", chatRouter);
app.use("/models", modelsRouter);

export default app;