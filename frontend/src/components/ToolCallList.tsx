import { useState } from "react";
import type { ToolInvocation } from "../lib/api.ts";

interface ToolCallListProps {
  calls: ToolInvocation[];
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "rgba(80, 220, 140, 0.9)",
  FAILED: "rgba(255, 110, 110, 0.9)",
  DENIED: "rgba(255, 110, 110, 0.9)",
  REJECTED: "rgba(255, 176, 87, 0.9)",
  AWAITING_APPROVAL: "rgba(255, 176, 87, 0.9)",
  EXECUTING: "rgba(120, 190, 255, 0.9)",
  CANCELLED: "rgba(255,255,255,0.4)",
};

/** The tool calls a turn actually made, with their outcome. Collapsed by default. */
export default function ToolCallList({ calls }: ToolCallListProps) {

  const [expanded, setExpanded] = useState<string | null>(null);

  if (calls.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, fontFamily: "var(--font-mono)" }}>
      {calls.map(call => {
        const open = expanded === call.id;
        const color = STATUS_COLOR[call.status] ?? "rgba(255,255,255,0.6)";

        return (
          <div
            key={call.id}
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              marginBottom: 8,
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setExpanded(open ? null : call.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "inherit",
              }}
            >
              <span style={{ color, fontSize: 9 }}>●</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", flex: 1 }}>{call.name}</span>
              {call.policy === "APPROVAL_REQUIRED" && (
                <span style={{ fontSize: 9, color: "rgba(255,176,87,0.75)", letterSpacing: "0.06em" }}>
                  GATED
                </span>
              )}
              <span style={{ fontSize: 10, color }}>{call.status.toLowerCase().replace(/_/g, " ")}</span>
              {call.ms !== undefined && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{call.ms}ms</span>
              )}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{open ? "−" : "+"}</span>
            </button>

            {open && (
              <div style={{ padding: "0 12px 12px 12px" }}>
                <Block label="arguments" body={JSON.stringify(call.arguments, null, 2)} />
                {call.result !== undefined && (
                  <Block label={call.isError ? "error" : "result"} body={call.result} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <pre
        style={{
          fontSize: 11,
          lineHeight: 1.55,
          background: "rgba(0,0,0,0.3)",
          borderRadius: 6,
          padding: 10,
          margin: 0,
          maxHeight: 220,
          overflow: "auto",
          color: "rgba(255,255,255,0.72)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {body}
      </pre>
    </div>
  );
}
