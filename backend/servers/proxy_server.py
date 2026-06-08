"""
Lumina Orchestrator — proxy_server.py
======================================
Composes autoGuiMCP and shellMCP into a single HTTP MCP endpoint.

FastMCP v3 API used here:
  - create_proxy(transport)          from fastmcp.server
  - PythonStdioTransport(...)        from fastmcp.client.transports
  - orchestrator.mount(proxy, namespace="name")

Run:
    python proxy_server.py

Then connect Claude Code (or your FastAPI backend) to:
    http://127.0.0.1:8082/mcp
"""

import os
import sys
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server import create_proxy
from fastmcp.client.transports import PythonStdioTransport

# ── Paths ─────────────────────────────────────────────────────────────────────
SERVERS_DIR = Path(__file__).parent.resolve()
VENV_PYTHON = SERVERS_DIR.parents[2] / "venv" / "bin" / "python"
PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

AUTOGUI_SCRIPT = SERVERS_DIR / "autoGuiMCP" / "server.py"
SHELL_SCRIPT   = SERVERS_DIR / "shellMCP"   / "server.py"

# ── Orchestrator ──────────────────────────────────────────────────────────────
orchestrator = FastMCP(
    name="LuminaOrchestrator",
    instructions=(
        "Single entry-point for all Lumina tools. "
        "Tools are namespaced: 'autogui_*' for GUI/desktop automation, "
        "'shell_*' for shell command execution."
    ),
)

# ── Mount sub-servers via stdio subprocess transport ─────────────────────────
#
# create_proxy() accepts any ClientTransport directly.
# PythonStdioTransport spawns the script as a child process and speaks
# MCP over its stdin/stdout — no HTTP server needed for the sub-servers.
#
# namespace="autogui"  →  tools become  autogui_move_cursor, autogui_click …
# namespace="shell"    →  tools become  shell_command

orchestrator.mount(
    create_proxy(
        PythonStdioTransport(
            script_path=AUTOGUI_SCRIPT,
            python_cmd=PYTHON,
        )
    ),
    namespace="autogui",
)

orchestrator.mount(
    create_proxy(
        PythonStdioTransport(
            script_path=SHELL_SCRIPT,
            python_cmd=PYTHON,
        )
    ),
    namespace="shell",
)

# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    host = os.getenv("ORCHESTRATOR_HOST", "127.0.0.1")
    port = int(os.getenv("ORCHESTRATOR_PORT", "8082"))

    print(f"[Lumina Orchestrator] http://{host}:{port}/mcp")
    print(f"  autogui_* tools  ← {AUTOGUI_SCRIPT}")
    print(f"  shell_*    tools  ← {SHELL_SCRIPT}")
    print(f"  Python           : {PYTHON}")

    orchestrator.run(transport="http", host=host, port=port)