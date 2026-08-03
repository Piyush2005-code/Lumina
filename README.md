# Lumina

**Lumina** is a deeply integrated, locally-aware AI assistant built as an autonomous agent runtime and orchestration platform — not just a chatbot or a thin wrapper around LLM APIs. It's designed for full system control, persistent memory, context-rich coding assistance, and extensible tool use, while doubling as a hands-on project for learning systems engineering, backend architecture, distributed coordination, memory retrieval, low-level sandboxing, and AI orchestration.

<p align="center">
  <img src="assets/lumina-demo.gif" alt="Lumina demo" width="100%">
</p>

## Core Design Philosophy

- **Build, don't bolt** — subsystems (sandboxed shell execution, memory engine, event bus) are implemented from scratch where it teaches the most, rather than leaning on pre-built frameworks.
- **Language-appropriate** — Python for AI glue and rapid prototyping, Go for high-concurrency backend services, Rust for low-level systems components where safety and performance matter.
- **Secure by default** — no direct agent-to-shell access; every tool call passes through a permission layer, validation, and sandboxing.
- **Scalable memory** — hierarchical, multi-modal context retrieval rather than naive vector search, respecting workspace boundaries, temporal dynamics, and semantic compression.
- **Event-driven backbone** — internal changes (shell output, file modification, agent lifecycle) are emitted as events for decoupled, observable, recoverable workflows.

## Architecture

Lumina is organized into seven layered subsystems:

1. **Agent Runtime Layer** — planning, tool routing, memory access, context assembly, multi-agent scheduling.
2. **Tooling / Capability Layer** — isolated, auditable tools for shell, filesystem, git, email, browser, etc.
3. **Memory & Context Layer** — episodic, semantic, workspace-specific, execution, and long-term summary memory.
4. **Sandbox Execution Layer** — process isolation (Linux namespaces, seccomp, cgroups) via a Rust executor.
5. **AI Orchestration Layer** — model-agnostic routing, planning, tool calling, and fallback logic.
6. **Coding Agent Infrastructure** — codebase indexing, AST parsing, symbol graphs, diff generation, build pipelines.
7. **Event-Driven Backend** — an async event bus connecting all modules, backed by PostgreSQL and message queues.

See [docs/Lumina.pdf](docs/Lumina.pdf) (or [docs/Lumina.tex](docs/Lumina.tex)) for the full technical plan and architecture document.

## Project Structure

```
agents-mcp/
├── backend/     # Node.js/TypeScript orchestration engine (providers, tools, MCP, websocket streaming)
├── frontend/    # React + Vite + Tailwind UI (chat pane, workspace layout, voice orb)
├── servers/     # MCP servers (shell, auto-GUI, proxy)
├── electron/    # Desktop app shell
├── docs/        # Technical plan and design docs
└── assets/      # Media assets
```

## Getting Started

**Backend**
```bash
cd backend
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
