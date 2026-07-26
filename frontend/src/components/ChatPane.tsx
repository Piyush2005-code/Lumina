import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendMessage, type ChatMessage } from "../lib/api.ts";

interface ChatPaneProps {
  provider: string;
  model: string;
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
      <Avatar isUser={false} />
      <div
        className="bubble-assistant"
        style={{ display: "flex", gap: 5, alignItems: "center", padding: "13px 16px" }}
      >
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

function Avatar({ isUser }: { isUser: boolean }) {
  return (
    <div
      style={{
        width: 28, height: 28, borderRadius: "50%",
        background: isUser
          ? "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)"
          : "rgba(15,30,65,0.85)",
        border: "1px solid " + (isUser ? "rgba(59,130,246,0.5)" : "var(--border)"),
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: isUser ? "0 2px 12px rgba(29,78,216,0.35)" : "none",
      }}
    >
      {isUser
        ? <User size={13} strokeWidth={2} style={{ color: "rgba(255,255,255,0.9)" }} />
        : <Bot  size={13} strokeWidth={1.8} style={{ color: "var(--text-secondary)" }} />
      }
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <Avatar isUser={isUser} />
      <div className={isUser ? "bubble-user" : "bubble-assistant"}>
        {isUser
          ? <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
          : <ReactMarkdown>{msg.content}</ReactMarkdown>
        }
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 40,
        opacity: 0.7,
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: "rgba(15,30,65,0.6)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 24px rgba(59,130,246,0.08)",
        }}
      >
        <Bot size={20} strokeWidth={1.5} style={{ color: "var(--accent-bright)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
          Ready when you are
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Select a model from the sidebar and start typing.
        </p>
      </div>
    </div>
  );
}

export default function ChatPane({ provider, model }: ChatPaneProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!provider || !model) { setError("Please select a model first."); return; }

    setError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: ChatMessage = { role: "user", content: text };
    setHistory(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendMessage({ provider, model, message: text, history });
      setHistory(prev => [...prev, { role: "assistant", content: res.response }]);
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong.");
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, history, provider, model]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  const canSend = !!input.trim() && !loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Messages */}
      <div
        id="chat-message-list"
        style={{
          flex: 1, overflowY: "auto",
          padding: "28px 32px",
          display: "flex", flexDirection: "column", gap: 22,
        }}
      >
        {history.length === 0 && !loading && <EmptyState />}
        {history.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "0 32px 8px",
            padding: "9px 14px",
            borderRadius: 10,
            background: "rgba(220,30,30,0.08)",
            border: "1px solid rgba(220,50,50,0.25)",
            fontSize: 12.5,
            color: "rgba(248,113,113,0.9)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {error}
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: "0 28px 24px", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <textarea
            id="chat-input"
            ref={textareaRef}
            className="chat-input"
            placeholder="Message Lumina… (⏎ send · Shift+⏎ newline)"
            value={input}
            onChange={e => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            id="chat-send-btn"
            onClick={() => void submit()}
            disabled={!canSend}
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 34, height: 34,
              borderRadius: "50%",
              border: "none",
              cursor: canSend ? "pointer" : "not-allowed",
              background: canSend
                ? "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)"
                : "rgba(20,40,80,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.22s ease, transform 0.15s ease, opacity 0.2s ease",
              transform: canSend ? "scale(1)" : "scale(0.88)",
              opacity: canSend ? 1 : 0.4,
              boxShadow: canSend ? "0 2px 14px rgba(29,78,216,0.45)" : "none",
            }}
          >
            <Send
              size={14} strokeWidth={2}
              style={{ color: canSend ? "white" : "var(--text-muted)" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
