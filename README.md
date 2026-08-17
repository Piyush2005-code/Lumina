<div align="center">

<img src="assets/lumina-demo.gif" alt="Lumina — 2× speed demo" width="860" />

<br/>

# Lumina

**A locally-running AI agent with capability-aware routing and human-approved tool execution.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A.svg?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-000000.svg?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-000000.svg?style=for-the-badge)](https://modelcontextprotocol.io/)
[![Node](https://img.shields.io/badge/Node.js_%3E%3D22.5-339933.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

Lumina is a cross-platform desktop AI assistant built on an **agent runtime**, not a chat wrapper. It routes each turn to a model chosen by measured latency and declared capabilities, executes tools through the [Model Context Protocol](https://modelcontextprotocol.io/), and **refuses to take any action with side effects until a human has explicitly approved that specific call.**

---

## Table of Contents

- [Why Lumina](#why-lumina)
- [Features](#features)
- [Architecture](#architecture)
- [Supported Providers](#supported-providers)
- [MCP Tool Servers](#mcp-tool-servers)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Design Principles](#design-principles)
- [Contributing](#contributing)

---

## Why Lumina

Most AI chat apps are browser wrappers around an API. Lumina is different:

- **Your keys never leave your machine.** They live in the OS keychain and are injected directly into a child process at runtime. The browser renderer never sees them.
- **The agent can use your computer as a tool** — read files, run shell commands, send email, control the GUI — but it asks you first for anything that has a side effect.
- **It routes intelligently.** Every turn passes through a telemetry-driven scheduler that picks the best available model for the task, and automatically fails over if that model errors.
- **It runs entirely locally.** The backend binds to `127.0.0.1` only. There is no cloud relay, no analytics, no telemetry leaving the machine.

---

## Features

| | |
|---|---|
| 🧠 **Multi-provider routing** | Groq, Google Gemini, OpenRouter (GPT-4o, Claude, DeepSeek…), NVIDIA NIM — all behind one interface |
| ⚡ **Capability-aware scheduling** | Hard-filters by tool support / vision / context window; ranks survivors by latency, reliability, cost, quality |
| 📊 **Live telemetry** | Measures real p50 latency per model, tracks error rates, feeds back into routing decisions |
| 🔒 **Human-in-the-loop approvals** | Side-effecting tools (shell, email, file writes) pause and show an approval card before executing |
| 🔌 **MCP tool layer** | Filesystem, shell, email, GUI automation — each in its own isolated process |
| 💾 **SQLite persistence** | Full conversation history, tool execution log, and approval records survive restarts |
| 🖥️ **Electron desktop shell** | OS keychain credential store, sandboxed renderer, CSP-enforced security policy |
| 🌐 **Browser-compatible** | The same React frontend works directly against the backend in a browser during development |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Electron Main Process  (Node, full trust)        │
│                                                              │
│   CredentialStore ──keys──▶ BackendProcess (child)          │
│          ▲                         │                         │
│       ipcMain ◀────────────────────┤                         │
│                           HTTP on 127.0.0.1                  │
└──────────┬───────────────────────────────────────────────────┘
           │ contextBridge  (frozen window.lumina.*)
┌──────────┴── preload (isolated) ────────────────────────────┐
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────┴── Renderer  (sandboxed React / Vite) ───────────┐
│  WorkspaceLayout → ChatPane  │  Sidebar (Models, Tools,    │
│  ApprovalCard                │  Telemetry, API Keys)       │
└────────────────────────────────────────────────────────────┘

Backend Express (127.0.0.1 only)
  ├── Scheduler          capability filter → weighted score → ranked candidates
  ├── InferenceRouter    calls winner, auto-failover on error
  ├── AgentRuntime       the agent loop — drives model ↔ tool iterations
  ├── ToolPolicy         rule chain: validate args → approval gate → allow
  ├── MCP layer          stdio / HTTP transport to external tool servers
  ├── ProviderRegistry   lazy-instantiated provider clients (Groq, Gemini, …)
  ├── ApprovalStore      tracks pending / decided approvals
  └── SQLite             conversations, tool executions, telemetry
```

The agent loop can **suspend mid-turn** when a tool needs approval. The transcript stays in SQLite. When you approve or reject, `continueTurn` resumes exactly where it stopped — the model sees a seamless history.

---

## Supported Providers

| Provider | Models | Notes |
|---|---|---|
| **Groq** | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | Fastest inference; ~250–600 ms p50 |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-2.5-pro` | Vision + 1M token context |
| **OpenRouter** | Llama 3.3 70B, GPT-4o mini, Claude Sonnet 4.5, DeepSeek Chat | One key, many vendors |
| **NVIDIA NIM** | `llama-3.1-70b-instruct`, `llama-3.1-8b-instruct` | Self-hostable inference |

At least one provider key is required. The scheduler will route around any provider whose key is missing.

---

## MCP Tool Servers

Tools are isolated processes connected via the [Model Context Protocol](https://modelcontextprotocol.io/). Each has an explicit execution policy:

| Server | Language | Policy | Capabilities |
|---|---|---|---|
| `shellMCP` | Python | 🔴 Approval required | Run arbitrary shell commands |
| `emailMCP` | Python | 🔴 Approval required | Send email over SMTP |
| `filesystemMCP` | Python | 🟡 Read free / Write requires approval | Read, write, list files |
| `autoGuiMCP` | Python | 🔴 Approval required | Mouse, keyboard, screen control |

🟢 = runs automatically · 🔴 = pauses for your explicit sign-off

Side-effecting tools are tagged `APPROVAL_REQUIRED` at registration. The policy is enforced at the **executor**, not the UI — there is no UI path that bypasses it.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 22.5.0
- **Python** ≥ 3.10 (for MCP servers)
- At least one API key from a [supported provider](#supported-providers)

### Install

```bash
git clone https://github.com/Piyush2005-code/Lumina.git
cd Lumina
npm run install:all
```

### Configure

```bash
cp .env.example backend/.env
# Edit backend/.env and add at least one provider key
```

### Run (browser mode)

Three terminals:

```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev:frontend

# Visit http://localhost:5173
```

### Run (desktop app)

```bash
npm run desktop
```

The Electron app boots the backend automatically and stores API keys in the OS keychain — no `.env` file needed after first setup.

### Build a distributable

```bash
npm run package          # current platform
npm run package:mac      # macOS .dmg
npm run package:win      # Windows installer
npm run package:linux    # Linux AppImage / deb
```

---

## Configuration

All runtime options live in `backend/.env` (or are injected from the OS keychain in the desktop build).

```bash
# ── Model providers (at least one required) ──────────────────────────
GROQ_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
NVIDIA_NIMS_API_KEY=

# Optional OpenRouter attribution
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=Lumina

# ── Email MCP (optional) ─────────────────────────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# ── Runtime ──────────────────────────────────────────────────────────
PORT=3000
LOG_LEVEL=info          # debug | info | warn | error | silent
# LUMINA_DATA_DIR=      # where SQLite and email drafts live
# LUMINA_ENABLE_AUTOGUI=0   # opt in to desktop-automation server
```

---

## Project Structure

```
Lumina/
├── backend/                   Node + Express agent runtime
│   └── src/
│       ├── api/routes/        REST endpoints (chat, approvals, models, tools, telemetry)
│       ├── approvals/         Approval state machine + SQLite store
│       ├── mcp/               MCP client, server registry, tool adapter
│       ├── providers/         Provider interface, registry, model catalogue
│       ├── runtime/           AgentRuntime, ConversationStore, ChatService
│       ├── scheduler/         Capability filter + weighted scoring + InferenceRouter
│       ├── telemetry/         Per-model latency and error tracking
│       ├── tools/             ToolRegistry, ToolPolicy, ToolExecutor, ToolExecutionStore
│       └── utils/             Logger, env
│
├── frontend/                  React 19 + Vite renderer
│   └── src/
│       ├── components/        WorkspaceLayout, ChatPane, ApprovalCard, ModelSelector,
│       │                      TelemetryPanel, CredentialsPanel, ToolCallList
│       └── lib/               Transport-agnostic API client (IPC ↔ fetch)
│
├── electron/                  Desktop shell
│   └── src/
│       ├── main.ts            Window creation, CSP, security policy
│       ├── preload.ts         contextBridge — window.lumina.*
│       ├── backend/           BackendProcess (spawn + supervise)
│       ├── credentials/       OS keychain wrapper
│       └── ipc/               IPC handler registrations
│
├── servers/                   MCP tool servers (Python)
│   ├── shellMCP/
│   ├── emailMCP/
│   ├── filesystemMCP/
│   └── autoGuiMCP/
│
├── docs/                      Technical design document (Lumina.tex / .pdf)
├── assets/                    Demo assets
└── package.json               Root scripts (install:all, dev:*, package:*)
```

---

## Design Principles

**Build, don't bolt.** Every subsystem — the scheduler, the approval state machine, the provider abstraction — is implemented from scratch where implementing it teaches the most. External dependencies are used for what they're good at (MCP SDK, SQLite, Electron), not as an excuse to skip understanding the domain.

**Secure by default.** There is no unattended path to a side effect. The permission layer is enforced at the executor, not the UI. The renderer is sandboxed. API keys never enter the JavaScript heap of the browser process.

**Explainable, not clever.** The scheduler is a deterministic weighted score. Every routing decision returns the numbers behind it — which models were eligible, which were excluded and why, what the score was, whether it used real telemetry or the catalogue prior. Routing is not a black box.

**Say only what is true.** Capability flags, telemetry figures, and this README describe the code that actually exists.

---

## Contributing

Pull requests are welcome. Please include a clear description of the change along with any relevant tests.

For larger changes, open an issue first to discuss what you'd like to change.

---

<div align="center">
<sub>Built by <a href="https://github.com/Piyush2005-code">Piyush2005-code</a></sub>
</div>