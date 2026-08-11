import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

import ToolCallList from "./ToolCallList.tsx";
import ApprovalCard from "./ApprovalCard.tsx";
import {
  sendMessage, continueTurn, approveCall, rejectCall,
  type Approval, type ChatResponse, type RoutingPreference, type ToolInvocation,
} from "../lib/api.ts";

interface ChatPaneProps {
  provider: string | null;
  model: string | null;
  preference: RoutingPreference;
}

type Entry =
  | { kind: "user"; id: string; content: string }
  | {
      kind: "assistant";
      id: string;
      content: string;
      toolCalls: ToolInvocation[];
      provider: string;
      model: string;
      rationale: string;
      ms: number;
      pending: boolean;
    };

let counter = 0;
const nextId = () => `entry-${++counter}`;

export default function ChatPane({ provider, model, preference }: ChatPaneProps) {

  const [entries, setEntries] = useState<Entry[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState<Approval[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, loading, pending]);

  /**
   * Autosize from the value, not from the keystroke — clearing `input` after a
   * send has to shrink the box back down, and an onChange handler never fires
   * for that.
   */
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [input]);

  const applyResponse = useCallback((response: ChatResponse) => {
    setConversationId(response.conversationId);
    setPending(response.pendingApprovals);
    setEntries(prev => [...prev, {
      kind: "assistant",
      id: nextId(),
      content: response.response,
      toolCalls: response.toolCalls,
      provider: response.provider,
      model: response.model,
      rationale: response.routing.rationale,
      ms: response.routing.ms,
      pending: response.status === "awaiting_approval",
    }]);
  }, []);

  const submit = useCallback(async () => {

    const text = input.trim();
    if (!text || loading || pending.length > 0) return;

    setError(null);
    setInput("");

    setEntries(prev => [...prev, { kind: "user", id: nextId(), content: text }]);
    setLoading(true);

    try {
      const response = await sendMessage({
        message: text,
        preference,
        ...(conversationId ? { conversationId } : {}),
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      });
      applyResponse(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
      // Focus survives the round trip, so the next message starts by typing.
      textareaRef.current?.focus();
    }
  }, [input, loading, pending.length, preference, conversationId, provider, model, applyResponse]);

  /**
   * Deciding the last outstanding approval resumes the turn. The client sends an
   * id and a verb — never the arguments — and the backend picks the transcript
   * back up from the database.
   */
  const decide = useCallback(async (id: string, approve: boolean) => {

    setDeciding(true);
    setError(null);

    try {
      await (approve ? approveCall(id) : rejectCall(id));

      const remaining = pending.filter(item => item.id !== id);
      setPending(remaining);

      if (remaining.length === 0 && conversationId) {
        setLoading(true);
        try {
          applyResponse(await continueTurn(conversationId, { preference }));
        } finally {
          setLoading(false);
          // The composer was disabled while approval was outstanding; hand the
          // caret back now that it is live again.
          textareaRef.current?.focus();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that decision");
    } finally {
      setDeciding(false);
    }
  }, [pending, conversationId, preference, applyResponse]);

  const blocked = pending.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 28px" }}>

          {entries.length === 0 && !loading && <EmptyState />}

          {entries.map(entry =>
            entry.kind === "user"
              ? <UserBlock key={entry.id} content={entry.content} />
              : <AssistantBlock key={entry.id} entry={entry} />
          )}

          {pending.map(approval => (
            <ApprovalCard key={approval.id} approval={approval} onDecide={decide} busy={deciding} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div
              style={{
                border: "1px solid rgba(255,110,110,0.3)",
                background: "rgba(255,110,110,0.06)",
                color: "rgba(255,140,140,0.95)",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 28px 24px" }}>
          <div
            /* Only when the click landed on the padding itself — otherwise this
               would steal the caret mid-drag and break text selection. */
            onMouseDown={event => {
              if (event.target === event.currentTarget && !blocked) {
                event.preventDefault();
                textareaRef.current?.focus();
              }
            }}
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 10,
              padding: "10px 12px",
              opacity: blocked ? 0.5 : 1,
              cursor: blocked ? "default" : "text",
              /* Belt and braces: the row itself must never scroll sideways. */
              overflow: "hidden",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              disabled={blocked}
              placeholder={blocked ? "Waiting on your approval above…" : "Ask Lumina…"}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              style={{
                flex: 1,
                /*
                 * minWidth: 0 is load-bearing. A flex item defaults to
                 * min-width: auto, which refuses to shrink below its content's
                 * intrinsic width — so one long unbroken token (a file path, a
                 * URL) pushed the textarea wider than the row and produced a
                 * horizontal scrollbar sitting on top of the text.
                 */
                minWidth: 0,
                width: "100%",
                display: "block",
                resize: "none",
                border: "none",
                outline: "none",
                padding: 0,
                background: "transparent",
                color: "rgba(255,255,255,0.9)",
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "var(--font-mono)",
                maxHeight: 160,
                /* Grow downward only; never sideways. */
                overflowX: "hidden",
                overflowY: "auto",
                /* Break a long token rather than letting it force a wider box. */
                overflowWrap: "anywhere",
                scrollbarWidth: "thin",
              }}
            />
            <button
              onClick={() => void submit()}
              disabled={blocked || loading || input.trim().length === 0}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                cursor: "pointer",
                padding: "4px 2px",
              }}
            >
              send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserBlock({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28, fontFamily: "var(--font-mono)" }}>
      <Label>USER</Label>
      <div style={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 1.7 }}>
        {content}
      </div>
    </div>
  );
}

function AssistantBlock({ entry }: { entry: Extract<Entry, { kind: "assistant" }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28, fontFamily: "var(--font-mono)" }}>
      <Label>LUMINA</Label>

      <ToolCallList calls={entry.toolCalls} />

      <div className="chat-msg-bot" style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 1.7 }}>
        <ReactMarkdown>{entry.content}</ReactMarkdown>
      </div>

      {!entry.pending && entry.provider !== "none" && (
        <div
          title={entry.rationale}
          style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2, letterSpacing: "0.03em" }}
        >
          {entry.provider} · {entry.model} · {entry.ms}ms
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
      {children}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
      <Label>LUMINA</Label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", height: 24 }}>
        <div className="typing-dot-mono" />
        <div className="typing-dot-mono" style={{ animationDelay: "0.15s" }} />
        <div className="typing-dot-mono" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        opacity: 0.45,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "rgba(255,255,255,0.6)",
      }}
    >
      [ system ready ]
    </div>
  );
}
