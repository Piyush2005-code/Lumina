import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { MCPServerConfig } from "../mcp/MCPServerConnection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolves from src/ in dev (tsx) and from dist/ after a build — both are two levels deep. */
const REPO_ROOT = path.resolve(__dirname, "../../../");

/**
 * Packaged builds relocate the Python servers out of the repo tree, so Electron
 * passes their location explicitly. In development the repo layout is the answer.
 */
const SERVERS_DIR = process.env.LUMINA_SERVERS_DIR ?? path.join(REPO_ROOT, "servers");

const VENV_PYTHON = path.join(REPO_ROOT, "venv", "bin", "python");
const PYTHON = process.env.LUMINA_PYTHON
    ?? (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3");

function serverScript(folder: string): string {
    return path.join(SERVERS_DIR, folder, "server.py");
}

function enabled(flag: string, fallback: boolean): boolean {
    const value = process.env[flag];
    if (value === undefined) return fallback;
    return value === "1" || value.toLowerCase() === "true";
}

/**
 * Every MCP server the backend connects to on startup.
 *
 * autoGui is opt-in: it drives the real cursor and keyboard, which is hostile on
 * a machine someone is using. Everything else is on by default — the tool policy
 * layer, not the connection list, is what keeps the dangerous calls behind a human.
 */
export const mcpServerConfigs: MCPServerConfig[] = [
    {
        id: "filesystem",
        label: "Filesystem",
        transport: {
            type: "stdio",
            command: PYTHON,
            args: [serverScript("filesystemMCP")],
        },
    },
    {
        id: "shell",
        label: "Shell",
        transport: {
            type: "stdio",
            command: PYTHON,
            args: [serverScript("shellMCP")],
        },
    },
    {
        id: "email",
        label: "Email",
        transport: {
            type: "stdio",
            command: PYTHON,
            args: [serverScript("emailMCP")],
            env: {
                // The email server writes drafts next to the rest of Lumina's state.
                LUMINA_DATA_DIR: process.env.LUMINA_DATA_DIR ?? path.join(REPO_ROOT, ".lumina"),
                ...(process.env.SMTP_HOST !== undefined ? { SMTP_HOST: process.env.SMTP_HOST } : {}),
                ...(process.env.SMTP_PORT !== undefined ? { SMTP_PORT: process.env.SMTP_PORT } : {}),
                ...(process.env.SMTP_USER !== undefined ? { SMTP_USER: process.env.SMTP_USER } : {}),
                ...(process.env.SMTP_PASSWORD !== undefined ? { SMTP_PASSWORD: process.env.SMTP_PASSWORD } : {}),
                ...(process.env.SMTP_FROM !== undefined ? { SMTP_FROM: process.env.SMTP_FROM } : {}),
            },
        },
    },
    ...(enabled("LUMINA_ENABLE_AUTOGUI", false)
        ? [{
            id: "autogui",
            label: "Desktop control",
            transport: {
                type: "stdio" as const,
                command: PYTHON,
                args: [serverScript("autoGuiMCP")],
            },
        }]
        : []),
];
