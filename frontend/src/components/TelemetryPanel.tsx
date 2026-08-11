import { useCallback, useEffect, useState } from "react";
import { fetchTelemetry, resetTelemetry, type TelemetrySnapshot } from "../lib/api.ts";

/**
 * The numbers the scheduler is actually reading.
 *
 * This is not a report on routing decisions — it is the input to them. A model
 * whose p50 climbs here starts losing candidate rankings on the next turn, and a
 * provider that rate-limits shows up in `cooldowns` while it is being skipped.
 */
export default function TelemetryPanel() {

  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await fetchTelemetry());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load telemetry");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const clear = async () => {
    try {
      setSnapshot(await resetTelemetry());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset telemetry");
    }
  };

  if (error) {
    return <Empty text={error} />;
  }
  if (!snapshot) {
    return <Empty text="loading…" />;
  }

  const cooldowns = snapshot.cooldowns ?? [];

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
          MEASURED LATENCY
        </span>
        <button onClick={() => void clear()} style={linkButton}>reset</button>
      </div>

      {cooldowns.length > 0 && (
        <div
          style={{
            border: "1px solid rgba(255,176,87,0.3)",
            background: "rgba(255,176,87,0.06)",
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 12,
            color: "rgba(255,176,87,0.9)",
          }}
        >
          {cooldowns.map(entry => (
            <div key={entry.provider}>
              {entry.provider} cooling down · {Math.ceil(entry.remainingMs / 1000)}s
            </div>
          ))}
        </div>
      )}

      {snapshot.stats.length === 0 ? (
        <Empty text="no calls yet — send a message and the scheduler starts measuring" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: "0.06em" }}>
              <Th align="left">MODEL</Th>
              <Th>p50</Th>
              <Th>p95</Th>
              <Th>n</Th>
              <Th>err</Th>
            </tr>
          </thead>
          <tbody>
            {snapshot.stats.map(stat => (
              <tr key={`${stat.provider}/${stat.model}`} style={{ color: "rgba(255,255,255,0.75)" }}>
                <Td align="left">
                  <div style={{ color: "rgba(255,255,255,0.85)" }}>{stat.model}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{stat.provider}</div>
                </Td>
                <Td>{stat.p50Ms ?? "—"}</Td>
                <Td>{stat.p95Ms ?? "—"}</Td>
                <Td>{stat.calls}</Td>
                <Td>
                  <span style={{ color: stat.errors > 0 ? "rgba(255,110,110,0.9)" : "inherit" }}>
                    {stat.errors > 0 ? `${Math.round(stat.errorRate * 100)}%` : "0"}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
        <div>{snapshot.totals.providerCalls} provider calls · {snapshot.totals.errors} failed</div>
        <div>
          {snapshot.totals.promptTokens.toLocaleString()} in ·{" "}
          {snapshot.totals.completionTokens.toLocaleString()} out
        </div>
        <div style={{ fontSize: 9, marginTop: 4 }}>
          window: last {Math.round(snapshot.windowMs / 60000)} min
        </div>
      </div>
    </div>
  );
}

function Th({ children, align = "right" }: { children: string; align?: "left" | "right" }) {
  return <th style={{ textAlign: align, padding: "4px 6px", fontWeight: 400 }}>{children}</th>;
}

function Td({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ textAlign: align, padding: "6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      {children}
    </td>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
      {text}
    </div>
  );
}

const linkButton = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.4)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  cursor: "pointer",
  padding: 0,
} as const;
