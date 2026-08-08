import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { CredentialStore } from "../credentials/CredentialStore";
import type { BackendStatus } from "../shared/bridge";

const DEFAULT_PORT = 3000;
const READY_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 250;

/**
 * Owns the Node/Express orchestration runtime as a child process.
 *
 * This is where credential isolation actually happens: the decrypted keys are
 * read from the OS keychain and passed straight into the child's environment.
 * They exist in the main process for the duration of one `spawn` call and are
 * never written to disk, never sent over IPC, and never reachable from the
 * renderer.
 *
 * If a backend is already listening — the usual case during development, when
 * `npm run dev` is running in another terminal — Lumina attaches to it instead
 * of starting a second one.
 */
export class BackendProcess {

    private child: ChildProcess | undefined;
    private state: BackendStatus["state"] = "stopped";
    private error: string | null = null;
    private external = false;

    private readonly port: number;

    constructor(private readonly credentials: CredentialStore) {
        this.port = Number(process.env.LUMINA_PORT) || DEFAULT_PORT;
    }

    get url(): string {
        return `http://127.0.0.1:${this.port}`;
    }

    status(): BackendStatus {
        return {
            state: this.state,
            url: this.url,
            error: this.error,
            external: this.external,
            encryptionAvailable: this.credentials.isEncryptionAvailable(),
        };
    }

    async start(): Promise<BackendStatus> {

        this.state = "starting";
        this.error = null;

        if (await this.isHealthy()) {
            // Someone else's backend is already on the port. Use it rather than
            // fighting over it — and remember not to kill it on quit.
            this.external = true;
            this.state = "attached";
            console.log(`[lumina] attached to an existing backend at ${this.url}`);
            return this.status();
        }

        const entry = this.resolveServerEntry();

        if (entry === undefined) {
            this.state = "failed";
            this.error =
                "Could not find the compiled backend. Run `npm run build` in backend/, " +
                "or start it separately with `npm run dev`.";
            console.error(`[lumina] ${this.error}`);
            return this.status();
        }

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            // Runs this Electron binary as a plain Node process, so the packaged
            // app needs no Node installed on the user's machine.
            ELECTRON_RUN_AS_NODE: "1",
            PORT: String(this.port),
            LUMINA_DATA_DIR: app.getPath("userData"),
            LUMINA_SERVERS_DIR: this.resolveServersDir(),
            // Decrypted here, consumed by the child, never persisted in the clear.
            ...this.credentials.resolveAll(),
        };

        console.log(`[lumina] starting backend: ${entry}`);

        this.child = spawn(process.execPath, [entry], {
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        this.child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[backend] ${chunk}`));
        this.child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[backend] ${chunk}`));

        this.child.on("exit", (code, signal) => {
            if (this.state !== "stopped") {
                this.state = "failed";
                this.error = `Backend exited (code ${code ?? "null"}, signal ${signal ?? "none"})`;
                console.error(`[lumina] ${this.error}`);
            }
            this.child = undefined;
        });

        const ready = await this.waitForReady();

        if (!ready) {
            this.state = "failed";
            this.error = this.error ?? `Backend did not become healthy within ${READY_TIMEOUT_MS}ms`;
            return this.status();
        }

        this.state = "running";
        console.log(`[lumina] backend ready at ${this.url}`);

        return this.status();
    }

    async restart(): Promise<BackendStatus> {
        await this.stop();
        return this.start();
    }

    async stop(): Promise<void> {

        this.state = "stopped";

        // Never kill a backend Lumina did not start.
        if (this.external || !this.child) {
            this.child = undefined;
            return;
        }

        const child = this.child;
        this.child = undefined;

        child.kill("SIGTERM");

        await new Promise<void>(resolve => {
            const timer = setTimeout(() => {
                child.kill("SIGKILL");
                resolve();
            }, 3_000);
            child.once("exit", () => {
                clearTimeout(timer);
                resolve();
            });
        });
    }

    /** Proxies a renderer request to the backend. The renderer never holds this URL. */
    async request(method: string, route: string, body?: unknown): Promise<unknown> {

        const response = await fetch(`${this.url}${route}`, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        const text = await response.text();
        const parsed: unknown = text.length > 0 ? JSON.parse(text) : {};

        if (!response.ok) {
            const message = typeof parsed === "object" && parsed !== null && "error" in parsed
                ? String((parsed as { error: unknown }).error)
                : `Request failed with ${response.status}`;
            throw new Error(message);
        }

        return parsed;
    }

    private async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(1_000) });
            if (!response.ok) return false;
            const body = await response.json() as { service?: string };
            return body.service === "Lumina Backend";
        } catch {
            return false;
        }
    }

    private async waitForReady(): Promise<boolean> {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        while (Date.now() < deadline) {
            if (this.child === undefined && this.state === "failed") return false;
            if (await this.isHealthy()) return true;
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
        return false;
    }

    /** dist/main.js → repo/electron/dist, so the repo root is three levels up. */
    private resolveServerEntry(): string | undefined {

        const candidates = app.isPackaged
            ? [path.join(process.resourcesPath, "backend", "dist", "server.js")]
            : [
                path.resolve(__dirname, "../../../backend/dist/server.js"),
                path.resolve(app.getAppPath(), "../backend/dist/server.js"),
            ];

        return candidates.find(candidate => fs.existsSync(candidate));
    }

    private resolveServersDir(): string {
        return app.isPackaged
            ? path.join(process.resourcesPath, "servers")
            : path.resolve(__dirname, "../../../servers");
    }
}
