import { app, BrowserWindow, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs";

import { CredentialStore } from "./credentials/CredentialStore";
import { BackendProcess } from "./backend/BackendProcess";
import { registerIpcHandlers } from "./ipc/handlers";

/**
 * Lumina desktop shell.
 *
 * Process layout:
 *
 *     ┌─────────────── Electron main (Node privileges) ───────────────┐
 *     │  CredentialStore  ──keys──>  BackendProcess (child)           │
 *     │        ▲                            │                         │
 *     │     ipcMain                    HTTP on loopback               │
 *     └────────┼────────────────────────────┼─────────────────────────┘
 *              │ contextBridge
 *     ┌────────┴─── preload (isolated) ───┐
 *     │        window.lumina.*            │
 *     └────────┬──────────────────────────┘
 *     ┌────────┴─── renderer (sandboxed React) ───┐
 *     │  no Node, no fs, no keys, no fetch to     │
 *     │  the backend — only the bridge            │
 *     └───────────────────────────────────────────┘
 */

const isDev = process.env.LUMINA_DEV === "1" || !app.isPackaged;
const DEV_SERVER_URL = process.env.LUMINA_DEV_SERVER ?? "http://localhost:5173";

let mainWindow: BrowserWindow | undefined;
let backend: BackendProcess | undefined;

/** Only these origins may ever be loaded or navigated to. */
function isAllowedUrl(url: string): boolean {
    if (url.startsWith("file://")) return true;
    if (isDev && url.startsWith(DEV_SERVER_URL)) return true;
    return false;
}

function applySecurityPolicy(): void {

    // A renderer that can't be granted a permission can't be tricked into
    // requesting one. Lumina's UI needs none of them.
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    // Content-Security-Policy for anything served over http(s) — i.e. the Vite
    // dev server. The packaged build loads from file:// and carries its policy
    // in a meta tag, since response headers do not exist there.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [
                    [
                        "default-src 'self'",
                        // Vite's dev client needs eval; the packaged build does not and does not get it.
                        isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: blob:",
                        "font-src 'self' data:",
                        isDev ? "connect-src 'self' ws://localhost:5173 http://localhost:5173" : "connect-src 'none'",
                        "object-src 'none'",
                        "base-uri 'none'",
                        "frame-ancestors 'none'",
                    ].join("; "),
                ],
            },
        });
    });
}

function createWindow(): BrowserWindow {

    const window = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        show: false,
        backgroundColor: "#020611",
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),

            /*
             * The three settings that make the renderer untrusted, and must not
             * be relaxed: the page gets its own JS context, no Node built-ins,
             * and an OS-level sandbox around the process.
             */
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,

            webSecurity: true,
            allowRunningInsecureContent: false,
            // Nothing in Lumina embeds third-party content, so no <webview> either.
            webviewTag: false,
            spellcheck: false,
        },
    });

    window.once("ready-to-show", () => window.show());

    // External links open in the user's browser; nothing opens a second Electron window.
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://")) {
            void shell.openExternal(url);
        }
        return { action: "deny" };
    });

    // A renderer that gets compromised still cannot navigate itself somewhere useful.
    window.webContents.on("will-navigate", (event, url) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            console.warn(`[lumina] blocked navigation to ${url}`);
        }
    });

    window.webContents.on("will-attach-webview", event => event.preventDefault());

    void loadRenderer(window);

    return window;
}

async function loadRenderer(window: BrowserWindow): Promise<void> {

    if (isDev) {
        try {
            await window.loadURL(DEV_SERVER_URL);
            window.webContents.openDevTools({ mode: "detach" });
            return;
        } catch {
            console.warn("[lumina] Vite dev server unreachable, falling back to the built renderer");
        }
    }

    const candidates = app.isPackaged
        ? [path.join(process.resourcesPath, "renderer", "index.html")]
        : [path.resolve(__dirname, "../../frontend/dist/index.html")];

    const built = candidates.find(candidate => fs.existsSync(candidate));

    if (built === undefined) {
        await window.loadURL(
            "data:text/html," + encodeURIComponent(
                "<body style='font:14px system-ui;background:#020611;color:#fff;padding:40px'>" +
                "<h2>Renderer not built</h2>" +
                "<p>Run <code>npm run build</code> in <code>frontend/</code>, " +
                "or start the Vite dev server with <code>npm run dev</code>.</p></body>"
            )
        );
        return;
    }

    await window.loadFile(built);
}

// One instance only: two Lumina windows would race over the same database and port.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {

    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    void app.whenReady().then(async () => {

        applySecurityPolicy();

        const credentials = new CredentialStore();

        if (!credentials.isEncryptionAvailable()) {
            console.warn(
                "[lumina] OS keychain unavailable — credentials cannot be stored. " +
                "Provider keys must come from the environment instead."
            );
        }

        backend = new BackendProcess(credentials);
        registerIpcHandlers(backend, credentials);

        // The window comes up first so the user sees the UI while the backend boots.
        mainWindow = createWindow();

        await backend.start();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                mainWindow = createWindow();
            }
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("before-quit", async event => {
        if (backend) {
            event.preventDefault();
            const stopping = backend;
            backend = undefined;
            await stopping.stop();
            app.quit();
        }
    });
}
