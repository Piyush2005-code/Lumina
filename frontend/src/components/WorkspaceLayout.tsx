import { useState, useEffect } from "react";
import ChatPane from "./ChatPane.tsx";
import { fetchModels, type ProviderInfo, type ModelInfo } from "../lib/api.ts";

interface ModelOption {
  provider: string;
  model: string;
  label: string;
}

interface WorkspaceLayoutProps {
  visible: boolean;
}

export default function WorkspaceLayout({ visible }: WorkspaceLayoutProps) {
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<ModelOption>({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
  });

  /* Load model list from backend */
  useEffect(() => {
    fetchModels()
      .then(data => {
        const flat: ModelOption[] = [];
        data.providers.forEach((p: ProviderInfo) => {
          p.models.forEach((m: ModelInfo) => {
            flat.push({ provider: p.id, model: m.id, label: m.name });
          });
        });
        if (flat.length > 0) {
          setOptions(flat);
          setSelected(flat[0]);
        }
      })
      .catch(() => {
        /* backend offline — stay with default */
      });
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = options.find(o => `${o.provider}::${o.model}` === e.target.value);
    if (found) setSelected(found);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.42s ease, transform 0.42s cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* ── Minimal top bar ─────────────────────── */}
      <header
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(3, 8, 22, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Wordmark */}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: "-0.03em",
            background: "linear-gradient(120deg, #fff 0%, #93C5FD 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Lumina
        </span>

        {/* Inline model picker — styled select, not a card panel */}
        {options.length > 0 && (
          <select
            id="model-picker"
            value={`${selected.provider}::${selected.model}`}
            onChange={handleSelectChange}
            style={{
              background: "rgba(10, 20, 50, 0.65)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              letterSpacing: "0.03em",
              padding: "5px 10px",
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
              /* show a subtle caret */
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(100,130,175,0.6)'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              paddingRight: 24,
            }}
          >
            {options.map(o => (
              <option
                key={`${o.provider}::${o.model}`}
                value={`${o.provider}::${o.model}`}
                style={{ background: "#0B1628", color: "#EEF2FF" }}
              >
                {o.provider} / {o.label}
              </option>
            ))}
          </select>
        )}
      </header>

      {/* ── Chat (full width) ────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ChatPane provider={selected.provider} model={selected.model} />
      </main>
    </div>
  );
}
