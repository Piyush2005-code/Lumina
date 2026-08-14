# Lumina

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A.svg?logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-000000.svg)](https://modelcontextprotocol.io/)
## Table of Contents
- [Introduction](#introduction)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Design Principles](#design-principles)
- [Contributing](#contributing)
## Introduction
Lumina is a cross-platform desktop AI assistant built on an agent runtime rather than a chat wrapper. It routes each turn to a model chosen from measured latency and declared capabilities, executes tools through the Model Context Protocol, and refuses to take any action with side effects until a human has approved that specific call.
## Project Structure
The project is organized into the following components:
- Backend: Node + Express agent runtime — providers, scheduler, MCP client, tool policy, approvals, telemetry, SQLite persistence
- Frontend: React 19 + Vite + Tailwind renderer
- Electron: Desktop shell — main process, preload bridge, credential store
- Servers: Python MCP servers (filesystem, shell, email, auto-GUI)
- Docs: Full technical plan (Lumina.tex / Lumina.pdf)
## Getting Started
To get started with the project, follow these steps:
1. Install the dependencies: `npm run install:all`
2. Start the backend: `npm run dev:backend`
3. Start the frontend: `npm run dev:frontend`
4. Start the desktop application: `npm run desktop`
## Design Principles
The project is guided by the following design principles:
- Build, don't bolt — subsystems are implemented where implementing them teaches the most.
- Secure by default — no unattended path to a side effect; the permission layer is enforced at the executor, not the UI.
- Explainable, not clever — the scheduler is a deterministic weighted score, and every routing decision reports the numbers behind it.
- Say only what is true — capability flags, telemetry and this README describe the code that exists.
## Contributing
Pull requests are welcome — please include a clear description of the change along with any relevant tests.