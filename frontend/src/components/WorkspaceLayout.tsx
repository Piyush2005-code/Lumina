import { useCallback, useEffect, useState } from "react";

import ChatPane from "./ChatPane.tsx";
import ModelSelector from "./ModelSelector.tsx";
import TelemetryPanel from "./TelemetryPanel.tsx";
import CredentialsPanel from "./CredentialsPanel.tsx";
import {
  fetchModels, fetchTools, fetchBackendStatus, isDesktop,
  type BackendStatus, type ProviderInfo, type RoutingPreference, type ToolsResponse,
} from "../lib/api.ts";

interface WorkspaceLayoutProps {
  visible: boolean;
}

type Tab = "models" | "tools" | "telemetry" | "keys";

const TABS: { id: Tab; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "tools", label: "Tools" },
  { id: "telemetry", label: "Telemetry" },
  { id: "keys", label: "Keys" },
];

export default function WorkspaceLayout({ visible }: WorkspaceLayoutProps) {

  const [tab, setTab] = useState<Tab>("models");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [tools, setTools] = useState<ToolsResponse | null>(null);
  const [status, setStatus] = useState<BackendStatus | null>(null);

  // null means "let the scheduler choose" rather than a hardcoded default.
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [preference, setPreference] = useState<RoutingPreference>("balanced");

  const load = useCallback(async () => {
    try {
      setStatus(await fetchBackendStatus());
    } catch {
      setStatus(null);
    }
    try {
      const [modelsResult, toolsResult] = await Promise.all([fetchModels(), fetchTools()]);
      setProviders(modelsResult.providers);
      setTools(toolsResult);
    } catch {
      // The sidebar degrades quietly; the chat pane surfaces the real error.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  const select = (nextProvider: string | null, nextModel: string | null) => {
    setProvider(nextProvider);
    setModel(nextModel);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(2, 6, 17, 0.6)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.42s ease, transform 0.42s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >

      <header
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: "-0.04em",
            color: "rgba(255, 255, 255, 0.9)",
          }}
        >
          Lumina
        </span>

        <StatusPill status={status} tools={tools} />
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChatPane provider={provider} model={model} preference={preference} />
        </main>

        <aside
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {TABS.map(entry => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                style={{
                  flex: 1,
                  padding: "12px 4px",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  background: "none",
                  border: "none",
                  borderBottom: `1px solid ${tab === entry.id ? "rgba(255,255,255,0.5)" : "transparent"}`,
                  color: tab === entry.id ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
            {tab === "models" && (
              <ModelSelector
                providers={providers}
                provider={provider}
                model={model}
                preference={preference}
                onSelect={select}
                onPreference={setPreference}
              />
            )}
            {tab === "tools" && <ToolList tools={tools} />}
            {tab === "telemetry" && <TelemetryPanel />}
            {tab === "keys" && <CredentialsPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ status, tools }: { status: BackendStatus | null; tools: ToolsResponse | null }) {

  const healthy = status?.state === "running" || status?.state === "attached";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "rgba(255,255,255,0.45)",
      }}
      title={status?.error ?? status?.state ?? "unknown"}
    >
      {tools && <span>{tools.counts.total} tools · {tools.counts.approvalRequired} gated</span>}
      <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
      <span>{isDesktop ? "desktop" : "browser"}</span>
      <span style={{ color: healthy ? "rgba(80,220,140,0.9)" : "rgba(255,110,110,0.9)", fontSize: 9 }}>●</span>
    </div>
  );
}

function ToolList({ tools }: { tools: ToolsResponse | null }) {

  if (!tools) {
    return <Muted>loading…</Muted>;
  }
  if (tools.tools.length === 0) {
    return <Muted>No MCP servers connected. Check the backend log for connection errors.</Muted>;
  }

  const servers = [...new Set(tools.tools.map(tool => tool.server))];

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
      {servers.map(server => (
        <div key={server} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
            {server.toUpperCase()}
          </div>
          {tools.tools.filter(tool => tool.server === server).map(tool => (
            <div key={tool.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  color: tool.executionPolicy === "APPROVAL_REQUIRED"
                    ? "rgba(255,176,87,0.9)"
                    : "rgba(80,220,140,0.7)",
                }}
                title={tool.executionPolicy === "APPROVAL_REQUIRED" ? "Needs your approval" : "Runs freely"}
              >
                ●
              </span>
              <span style={{ color: "rgba(255,255,255,0.72)" }} title={tool.description}>
                {tool.name.replace(/^[^_]+__/, "")}
              </span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
        Amber tools change something outside Lumina and stop for your approval.
      </div>
    </div>
  );
}

function Muted({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
      {children}
    </div>
  );
}
