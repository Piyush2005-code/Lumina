import express, { type Express } from "express";
import cors from "cors";
import healthRouter from "./api/routes/health.js";  

const app: Express = express();

/*
 * Register global middleware.
 */
app.use(cors());
app.use(express.json());
app.use("/health", healthRouter)

export default app;