import type { ProviderInfo, RoutingPreference } from "../lib/api.ts";

interface ModelSelectorProps {
  providers: ProviderInfo[];
  provider: string | null;
  model: string | null;
  preference: RoutingPreference;
  onSelect: (provider: string | null, model: string | null) => void;
  onPreference: (preference: RoutingPreference) => void;
}

const PREFERENCES: { id: RoutingPreference; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Blend latency, reliability, cost and capability tier." },
  { id: "speed", label: "Fastest", hint: "Rank by measured p50 latency." },
  { id: "quality", label: "Strongest", hint: "Prefer the highest capability tier that qualifies." },
  { id: "cost", label: "Cheapest", hint: "Prefer the lowest price per token." },
];

/**
 * Model choice is a *hint*, not a command.
 *
 * Picking a model adds a scoring bonus for it; it does not bypass the capability
 * filter. If the task needs tool calling and the chosen model cannot do it, the
 * scheduler routes elsewhere and says so in the rationale — which is the whole
 * point of routing on capabilities rather than on a dropdown.
 */
export default function ModelSelector({
  providers, provider, model, preference, onSelect, onPreference,
}: ModelSelectorProps) {

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>

      <SectionLabel>ROUTING</SectionLabel>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {PREFERENCES.map(option => (
          <button
            key={option.id}
            title={option.hint}
            onClick={() => onPreference(option.id)}
            style={chipStyle(preference === option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <SectionLabel>MODEL</SectionLabel>

      <button
        onClick={() => onSelect(null, null)}
        style={{
          ...rowStyle(provider === null),
          marginBottom: 10,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.85)" }}>Auto</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          scheduler decides
        </span>
      </button>

      {providers.map(entry => (
        <div key={entry.id} style={{ marginBottom: 14 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>
              {entry.name.toUpperCase()}
            </span>
            {!entry.configured && (
              <span
                title={`Missing ${entry.missingCredentials.join(", ")}`}
                style={{ fontSize: 9, color: "rgba(255,176,87,0.8)" }}
              >
                NO KEY
              </span>
            )}
          </div>

          {entry.models.map(item => {
            const selected = provider === entry.id && model === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(entry.id, item.id)}
                disabled={!entry.configured}
                title={item.description}
                style={{
                  ...rowStyle(selected),
                  opacity: entry.configured ? 1 : 0.35,
                  cursor: entry.configured ? "pointer" : "not-allowed",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{item.name}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {item.capabilities.tools && <Tag>tools</Tag>}
                  {item.capabilities.vision && <Tag>vision</Tag>}
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                    {Math.round(item.capabilities.maxContext / 1000)}k
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        padding: "1px 5px",
        borderRadius: 3,
        color: "rgba(120,190,255,0.85)",
        background: "rgba(120,190,255,0.1)",
      }}
    >
      {children}
    </span>
  );
}

function chipStyle(active: boolean) {
  return {
    padding: "5px 12px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    borderRadius: 5,
    cursor: "pointer",
    color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
    background: active ? "rgba(255,255,255,0.1)" : "transparent",
    border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
  } as const;
}

function rowStyle(active: boolean) {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    textAlign: "left" as const,
    borderRadius: 6,
    cursor: "pointer",
    background: active ? "rgba(255,255,255,0.09)" : "transparent",
    border: `1px solid ${active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
    color: "inherit",
  } as const;
}
