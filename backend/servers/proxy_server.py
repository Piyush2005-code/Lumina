"""
Orchestrator Proxy Server
=========================
A single FastMCP server that composes both autoGuiMCP and shellMCP into one
unified endpoint.  Clients (e.g. Claude Code) connect to this one server
and get access to every tool from every sub-server, each scoped under its
own namespace to avoid naming collisions.

Architecture:
  ┌─────────────────────────────────────────────────────┐
  │            proxy_server.py  (port 8082)              │
  │                                                      │
  │  namespace "autogui"  ◄──stdio──► autoGuiMCP/server  │
  │  namespace "shell"    ◄──stdio──► shellMCP/server    │
  └─────────────────────────────────────────────────────┘

How to run:
    python proxy_server.py

Then add to Claude Code's MCP config (or ~/.claude.json):
    {
      "orchestrator": {
        "type": "http",
        "url": "http://localhost:8082/mcp"
      }
    }
"""

import sys
import os
from pathlib import Path
from fastmcp import FastMCP

# ── Resolve paths relative to this file so the server can be run from anywhere ──
SERVERS_DIR = Path(__file__).parent
VENV_PYTHON = Path(__file__).parents[3] / "venv" / "bin" / "python"  # adjust if needed

# Use the venv python that has the dependencies, falling back to current interpreter
PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable


# ── Sub-server definitions ────────────────────────────────────────────────────
# Each entry: (namespace, command, args)
# These are launched as subprocesses communicating over stdio (MCP default transport)
SUB_SERVERS = [
    {
        "namespace": "autogui",
        "command": PYTHON,
        "args": [str(SERVERS_DIR / "autoGuiMCP" / "server.py")],
        "env": None,   # inherits current env; set a dict to override
    },
    {
        "namespace": "shell",
        "command": PYTHON,
        "args": [str(SERVERS_DIR / "shellMCP" / "server.py")],
        "env": None,
    },
]


orchestrator = FastMCP(
    name="Orchestrator",
    instructions=(
        "You are connected to the Lumina orchestrator. "
        "Tools are namespaced: use 'autogui_*' for GUI automation "
        "and 'shell_*' for shell commands."
    ),
)

for server_cfg in SUB_SERVERS:
    from fastmcp.client.transports import PythonStdioTransport

    transport = PythonStdioTransport(
        script_path=server_cfg["args"][0],
        python_cmd=server_cfg["command"],
        env=server_cfg.get("env"),
    )

    from fastmcp.server.proxy import FastMCPProxy
    proxy = FastMCPProxy.from_client_transport(transport)

    orchestrator.mount(proxy, prefix=server_cfg["namespace"])


if __name__ == "__main__":
    HOST = os.getenv("ORCHESTRATOR_HOST", "127.0.0.1")
    PORT = int(os.getenv("ORCHESTRATOR_PORT", "8082"))

    print(f"[Orchestrator] Starting on http://{HOST}:{PORT}")
    print(f"[Orchestrator] Mounted servers:")
    for s in SUB_SERVERS:
        print(f"  - namespace='{s['namespace']}'  script={s['args'][0]}")

    orchestrator.run(transport="http", host=HOST, port=PORT)