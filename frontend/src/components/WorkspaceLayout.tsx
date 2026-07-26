import ChatPane from "./ChatPane.tsx";

interface WorkspaceLayoutProps {
  visible: boolean;
}

export default function WorkspaceLayout({ visible }: WorkspaceLayoutProps) {
  // Hardcoded for extreme minimalism. If a model switcher is needed later, 
  // it should be integrated in a minimal command-menu or hidden settings pane.
  const provider = "groq";
  const model = "llama-3.3-70b-versatile";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
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

      {/* ── Chat (full width) ────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ChatPane provider={provider} model={model} />
      </main>
    </div>
  );
}
