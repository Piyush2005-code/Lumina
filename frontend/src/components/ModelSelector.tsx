import { useEffect, useState } from "react";
import { Zap, Brain, RefreshCw, WifiOff } from "lucide-react";
import { fetchModels, type ProviderInfo, type ModelInfo } from "../lib/api.ts";
import clsx from "clsx";

interface SelectedModel {
  provider: string;
  model: string;
}

interface ModelSelectorProps {
  selected: SelectedModel;
  onSelect: (sel: SelectedModel) => void;
}

function ProviderIcon({ id }: { id: string }) {
  const style = { color: "var(--accent-bright)", flexShrink: 0 as const };
  if (id === "groq")   return <Zap   size={12} strokeWidth={2} style={style} />;
  if (id === "gemini") return <Brain size={12} strokeWidth={2} style={style} />;
  return <Zap size={12} strokeWidth={2} style={style} />;
}

function fmtCtx(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${n / 1_000_000}M ctx`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
}

/* Skeleton pulse card */
function SkeletonCard() {
  return (
    <div
      style={{
        height: 76,
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, transparent 0%, rgba(40,80,160,0.08) 50%, transparent 100%)",
          animation: "shimmer 1.6s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
    </div>
  );
}

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchModels()
      .then(d => { setProviders(d.providers); setLoading(false); })
      .catch(e => { setError((e as Error).message); setLoading(false); });
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          border: "1px solid rgba(59,130,246,0.20)",
          background: "var(--card-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <WifiOff size={14} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Backend offline</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Start the backend server to load models.
        </p>
        <button
          onClick={load}
          style={{
            display: "flex", gap: 5, alignItems: "center",
            fontSize: 11.5, color: "var(--accent-bright)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "var(--font-sans)",
          }}
        >
          <RefreshCw size={11} strokeWidth={2} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {providers.map((provider: ProviderInfo) => (
        <div key={provider.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Provider label */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 10, fontWeight: 600,
              letterSpacing: "0.10em",
              textTransform: "uppercase" as const,
              color: "var(--text-muted)",
              padding: "0 3px",
              fontFamily: "var(--font-sans)",
            }}
          >
            <ProviderIcon id={provider.id} />
            {provider.name}
          </div>

          {/* Model cards */}
          {provider.models.map((model: ModelInfo) => {
            const isSelected = selected.provider === provider.id && selected.model === model.id;
            return (
              <button
                key={model.id}
                id={`model-${provider.id}-${model.id}`}
                className={clsx("model-card", { selected: isSelected })}
                onClick={() => onSelect({ provider: provider.id, model: model.id })}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: "var(--font-sans)",
                      color: isSelected ? "var(--accent-bright)" : "var(--text-primary)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {model.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                      lineHeight: 1.45,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {model.description}
                  </span>
                  {model.contextWindow && (
                    <span
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.04em",
                        color: isSelected ? "rgba(96,165,250,0.75)" : "var(--text-muted)",
                        transition: "color 0.2s ease",
                      }}
                    >
                      {fmtCtx(model.contextWindow)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
