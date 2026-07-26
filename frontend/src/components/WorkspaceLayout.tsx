import { useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import ModelSelector from "./ModelSelector.tsx";
import ChatPane from "./ChatPane.tsx";

const SIDEBAR_W = 256;

interface WorkspaceLayoutProps {
  visible: boolean;
}

export default function WorkspaceLayout({ visible }: WorkspaceLayoutProps) {
  const [selected, setSelected] = useState({ provider: "groq", model: "llama-3.3-70b-versatile" });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
        background: "linear-gradient(135deg, hsl(220,40%,97%) 0%, hsl(240,30%,96%) 50%, hsl(260,30%,95%) 100%)",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 20px",
          borderBottom: "1.5px solid rgba(200,210,232,0.45)",
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Toggle sidebar */}
        <button
          id="sidebar-toggle-btn"
          onClick={() => setSidebarOpen(o => !o)}
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(200,210,230,0.25)",
            border: "1.5px solid rgba(200,210,232,0.45)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "hsl(225,15%,50%)", transition: "background 0.2s ease",
          }}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen
            ? <ChevronLeft size={14} strokeWidth={2} />
            : <ChevronRight size={14} strokeWidth={2} />
          }
        </button>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={16} strokeWidth={1.8} style={{ color: "hsl(234,55%,62%)" }} />
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 500,
              color: "hsl(225,25%,20%)",
              letterSpacing: "-0.02em",
            }}
          >
            Lumina
          </span>
        </div>

        {/* Active model badge */}
        <div style={{ marginLeft: "auto" }}>
          <span
            style={{
              fontSize: 11,
              color: "hsl(225,12%,58%)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.04em",
              background: "rgba(200,210,230,0.22)",
              padding: "4px 10px",
              borderRadius: 99,
              border: "1.5px solid rgba(200,210,232,0.4)",
            }}
          >
            {selected.provider} / {selected.model}
          </span>
        </div>
      </header>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar */}
        <aside
          style={{
            width: sidebarOpen ? SIDEBAR_W : 0,
            minWidth: sidebarOpen ? SIDEBAR_W : 0,
            overflow: "hidden",
            transition: "width 0.3s cubic-bezier(0.22,1,0.36,1), min-width 0.3s cubic-bezier(0.22,1,0.36,1)",
            borderRight: "1.5px solid rgba(200,210,232,0.45)",
            background: "rgba(255,255,255,0.42)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: SIDEBAR_W,
              height: "100%",
              overflowY: "auto",
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <p
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "hsl(225,15%,55%)",
                padding: "0 4px",
                marginBottom: 10,
              }}
            >
              Model
            </p>
            <ModelSelector selected={selected} onSelect={setSelected} />
          </div>
        </aside>

        {/* Chat area */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChatPane provider={selected.provider} model={selected.model} />
        </main>
      </div>
    </div>
  );
}
