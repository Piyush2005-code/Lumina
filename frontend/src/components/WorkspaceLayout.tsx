import { useState } from "react";
import { MessageSquareText, Mic } from "lucide-react";
import ChatPane from "./ChatPane.tsx";
import VoicePane from "./VoicePane.tsx";

interface WorkspaceLayoutProps {
  visible: boolean;
}

type InteractionMode = "text" | "voice";

export default function WorkspaceLayout({ visible }: WorkspaceLayoutProps) {
  const [mode, setMode] = useState<InteractionMode>("text");

  // Hardcoded for extreme minimalism
  const provider = "groq";
  const model = "llama-3.3-70b-versatile";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        // Translucent background to reveal the grain gradient from App.tsx
        background: "rgba(2, 6, 17, 0.55)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.42s ease, transform 0.42s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* ── Minimal left sidebar ─────────────────────── */}
      <aside
        style={{
          width: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "24px 0",
          borderRight: "1px solid rgba(255, 255, 255, 0.05)",
          flexShrink: 0,
          zIndex: 20,
          gap: 16,
        }}
      >
        <button
          onClick={() => setMode("text")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: mode === "text" ? "rgba(255, 255, 255, 0.1)" : "transparent",
            color: mode === "text" ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.4)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Text Mode"
        >
          <MessageSquareText size={20} strokeWidth={1.5} />
        </button>

        <button
          onClick={() => setMode("voice")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: mode === "voice" ? "rgba(255, 255, 255, 0.1)" : "transparent",
            color: mode === "voice" ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.4)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Voice Mode"
        >
          <Mic size={20} strokeWidth={1.5} />
        </button>
      </aside>

      {/* ── Main content area ────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* ── Minimal top bar ─────────────────────── */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            flexShrink: 0,
            zIndex: 10,
            background: mode === "text" ? "transparent" : "rgba(0,0,0,0.2)",
          }}
        >
          {/* Wordmark Only */}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 800,
              fontStyle: "italic",
              letterSpacing: "-0.04em",
              color: "rgba(255, 255, 255, 0.9)",
              mixBlendMode: "difference",
            }}
          >
            Lumina
          </span>
        </header>

        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          {mode === "text" ? (
            <ChatPane provider={provider} model={model} />
          ) : (
            <VoicePane provider={provider} model={model} />
          )}
        </main>
      </div>
    </div>
  );
}
