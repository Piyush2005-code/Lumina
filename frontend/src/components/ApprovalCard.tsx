import { useState } from "react";
import type { Approval } from "../lib/api.ts";

interface ApprovalCardProps {
  approval: Approval;
  onDecide: (id: string, approve: boolean) => Promise<void>;
  busy: boolean;
}

/**
 * The human half of human-in-the-loop.
 *
 * The card shows the exact arguments the backend hashed when it created this
 * approval — the same bytes it will re-hash before executing. Clicking approve
 * sends an id and nothing else, so what is displayed here and what runs cannot
 * drift apart.
 */
export default function ApprovalCard({ approval, onDecide, busy }: ApprovalCardProps) {

  const [decided, setDecided] = useState<"approve" | "reject" | null>(null);

  const decide = async (approve: boolean) => {
    setDecided(approve ? "approve" : "reject");
    try {
      await onDecide(approval.id, approve);
    } finally {
      setDecided(null);
    }
  };

  const remaining = Math.max(0, approval.expiresAt - Date.now());
  const minutes = Math.floor(remaining / 60000);

  return (
    <div
      style={{
        border: "1px solid rgba(255, 176, 87, 0.35)",
        background: "rgba(255, 176, 87, 0.06)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,176,87,0.9)" }}>
          APPROVAL REQUIRED
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          expires in {minutes}m
        </span>
      </div>

      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>
        <code style={{ color: "#ffb057" }}>{approval.toolName}</code>
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.6 }}>
        {approval.reason}
      </div>

      <pre
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          padding: 12,
          margin: "0 0 14px 0",
          overflowX: "auto",
          color: "rgba(255,255,255,0.75)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(approval.arguments, null, 2)}
      </pre>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void decide(true)}
          disabled={busy}
          style={buttonStyle("rgba(80, 220, 140, 0.5)", "rgba(80, 220, 140, 0.12)", busy)}
        >
          {decided === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => void decide(false)}
          disabled={busy}
          style={buttonStyle("rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)", busy)}
        >
          {decided === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function buttonStyle(border: string, background: string, busy: boolean) {
  return {
    flex: "0 0 auto",
    padding: "7px 18px",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    color: "rgba(255,255,255,0.9)",
    background,
    border: `1px solid ${border}`,
    borderRadius: 6,
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.5 : 1,
    transition: "opacity 0.15s ease",
  } as const;
}
