import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { MCPServerConfig } from "../mcp/MCPServerConnection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "../../../");
const SERVERS_DIR = path.join(REPO_ROOT, "servers");

const VENV_PYTHON = path.join(REPO_ROOT, "venv", "bin", "python");
const PYTHON = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3";

/**
 * Every MCP server the backend connects to on startup. Add entries here
 * as new servers (shell, auto-GUI, ...) come online.
 */
export const mcpServerConfigs: MCPServerConfig[] = [
    {
        id: "filesystem",
        label: "Filesystem",
        transport: {
            type: "stdio",
            command: PYTHON,
            args: [path.join(SERVERS_DIR, "filesystemMCP", "server.py")],
        },
    },
];
