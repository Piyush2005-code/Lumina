import { useEffect, useState } from "react";
import { Zap, Brain, RefreshCw, AlertCircle } from "lucide-react";
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

/* Icon per provider */
function ProviderIcon({ id }: { id: string }) {
  if (id === "groq") return <Zap size={14} strokeWidth={1.8} />;
  if (id === "gemini") return <Brain size={14} strokeWidth={1.8} />;
  return <Zap size={14} strokeWidth={1.8} />;
}

/* Format context window nicely */
function fmtCtx(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${n / 1_000_000}M ctx`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
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
      <div className="flex flex-col gap-3 p-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: 16,
              background: "rgba(200,210,230,0.2)",
              animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: 14,
          border: "1.5px solid rgba(200,210,232,0.55)",
          background: "rgba(248,248,252,0.88)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "hsl(225,15%,46%)" }}>
          <AlertCircle size={15} strokeWidth={1.8} />
          <span style={{ fontSize: 13 }}>Backend offline</span>
        </div>
        <p style={{ fontSize: 12, color: "hsl(225,12%,62%)", lineHeight: 1.5 }}>
          Start the backend to load models.
        </p>
        <button
          onClick={load}
          style={{
            display: "flex", gap: 6, alignItems: "center",
            fontSize: 12, color: "hsl(234,55%,65%)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <RefreshCw size={12} strokeWidth={2} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {providers.map((provider: ProviderInfo) => (
        <div key={provider.id} className="flex flex-col gap-2">
          {/* Provider label */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "hsl(225,15%,55%)",
              padding: "0 2px",
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
                style={{ width: "100%", textAlign: "left" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {/* Model name */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isSelected ? "hsl(234,55%,55%)" : "hsl(225,25%,22%)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {model.name}
                  </span>

                  {/* Description */}
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "hsl(225,12%,55%)",
                      lineHeight: 1.45,
                    }}
                  >
                    {model.description}
                  </span>

                  {/* Context window badge */}
                  {model.contextWindow && (
                    <span
                      style={{
                        marginTop: 2,
                        fontSize: 10.5,
                        color: isSelected ? "hsl(234,55%,62%)" : "hsl(225,12%,62%)",
                        fontFamily: "JetBrains Mono, monospace",
                        letterSpacing: "0.03em",
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
