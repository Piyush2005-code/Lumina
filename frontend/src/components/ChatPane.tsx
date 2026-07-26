import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendMessage, type ChatMessage } from "../lib/api.ts";

interface ChatPaneProps {
  provider: string;
  model: string;
}

/* Typing indicator */
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
      <div
        style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(200,210,230,0.35)",
          border: "1.5px solid rgba(200,210,232,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Bot size={13} strokeWidth={1.8} style={{ color: "hsl(225,15%,55%)" }} />
      </div>
      <div className="bubble-assistant" style={{ display: "flex", gap: 5, alignItems: "center", padding: "14px 18px" }}>
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

/* Single message bubble */
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isUser
            ? "linear-gradient(135deg, hsl(234,55%,65%) 0%, hsl(248,60%,70%) 100%)"
            : "rgba(200,210,230,0.35)",
          border: "1.5px solid rgba(200,210,232,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser
          ? <User size={13} strokeWidth={1.8} style={{ color: "white" }} />
          : <Bot size={13} strokeWidth={1.8} style={{ color: "hsl(225,15%,55%)" }} />
        }
      </div>

      {/* Bubble */}
      <div className={isUser ? "bubble-user" : "bubble-assistant"}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

/* Empty state */
function EmptyState() {
  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, padding: 32,
      }}
    >
      <div
        style={{
          width: 52, height: 52, borderRadius: 16,
          background: "rgba(200,210,230,0.25)",
          border: "1.5px solid rgba(200,210,232,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Bot size={22} strokeWidth={1.4} style={{ color: "hsl(225,15%,62%)" }} />
      </div>
      <p style={{ fontSize: 14, color: "hsl(225,12%,58%)", textAlign: "center", lineHeight: 1.6 }}>
        Select a model and start chatting.
      </p>
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

  /* Auto-scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  /* Auto-resize textarea */
  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resizeTextarea();
  };

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!provider || !model) { setError("Please select a model first."); return; }

    setError(null);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...history, userMsg];
    setHistory(next);
    setLoading(true);

    try {
      const res = await sendMessage({
        provider,
        model,
        message: text,
        history: history, // send existing history (before this message)
      });

      const assistantMsg: ChatMessage = { role: "assistant", content: res.response };
      setHistory(prev => [...prev, assistantMsg]);
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong.");
      // Remove the optimistically-added user message on error
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, history, provider, model]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Message list */}
      <div
        id="chat-message-list"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {history.length === 0 && !loading && <EmptyState />}
        {history.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div
          style={{
            margin: "0 28px 8px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,80,80,0.07)",
            border: "1.5px solid rgba(255,80,80,0.18)",
            fontSize: 12.5,
            color: "hsl(0,60%,48%)",
          }}
        >
          {error}
        </div>
      )}

      {/* Model badge */}
      {model && (
        <div style={{ padding: "0 28px 8px" }}>
          <span
            style={{
              fontSize: 11,
              color: "hsl(225,12%,62%)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.04em",
            }}
          >
            {provider} / {model}
          </span>
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          padding: "0 24px 24px",
          position: "relative",
        }}
      >
        <div style={{ position: "relative" }}>
          <textarea
            id="chat-input"
            ref={textareaRef}
            className="chat-input"
            placeholder="Message Lumina… (⏎ to send, Shift+⏎ for newline)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            id="chat-send-btn"
            onClick={() => void submit()}
            disabled={!input.trim() || loading}
            style={{
              position: "absolute",
              right: 12,
              bottom: 11,
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              background: !input.trim() || loading
                ? "rgba(200,210,230,0.3)"
                : "linear-gradient(135deg, hsl(234,55%,65%) 0%, hsl(248,60%,70%) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s ease, transform 0.15s ease, opacity 0.2s ease",
              transform: !input.trim() || loading ? "scale(0.92)" : "scale(1)",
              opacity: !input.trim() || loading ? 0.5 : 1,
              boxShadow: !input.trim() || loading
                ? "none"
                : "0 2px 10px hsl(234,55%,65%,0.3)",
            }}
          >
            <Send size={14} strokeWidth={2} style={{ color: !input.trim() || loading ? "hsl(225,12%,62%)" : "white" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
