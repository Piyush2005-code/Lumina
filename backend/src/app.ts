import express, { type Express } from "express";
import cors from "cors";

import healthRouter from "./api/routes/health.js";
import chatRouter from "./api/routes/chat.js";
import modelsRouter from "./api/routes/models.js";
import toolsRouter from "./api/routes/tools.js";
import approvalsRouter from "./api/routes/approvals.js";
import telemetryRouter from "./api/routes/telemetry.js";

const app: Express = express();

/*
 * Global middleware. The backend binds to loopback only (see server.ts), so CORS
 * exists for the Vite dev server on another port, not as a security boundary.
 */
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/*
 * Routes.
 */
app.use("/health", healthRouter);
app.use("/chat", chatRouter);
app.use("/models", modelsRouter);
app.use("/tools", toolsRouter);
app.use("/approvals", approvalsRouter);
app.use("/telemetry", telemetryRouter);

export default app;
