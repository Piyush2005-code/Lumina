import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { sendMessage, type ChatMessage } from "../lib/api.ts";

interface ChatPaneProps {
  provider: string;
  model: string;
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>LUMINA</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", height: 24 }}>
        <div className="typing-dot-mono" />
        <div className="typing-dot-mono" style={{ animationDelay: "0.15s" }} />
        <div className="typing-dot-mono" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

function MessageBlock({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 32,
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 10,
          color: isUser ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {isUser ? "USER" : "LUMINA"}
      </div>

      {/* Content */}
      <div
        className={isUser ? "chat-msg-user" : "chat-msg-bot"}
        style={{
          color: "rgba(255,255,255,0.9)",
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
        ) : (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        )}
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
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.5,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "rgba(255,255,255,0.6)",
        letterSpacing: "0.02em",
      }}
    >
      [ system ready ]
    </div>
  );
}

export default function ChatPane({ provider, model }: ChatPaneProps) {
  // Pre-fill some history as requested by the user: "having some chat history so far done"
  const [history, setHistory] = useState<ChatMessage[]>([
    { role: "user", content: "Initialize workspace." },
    { role: "assistant", content: "Workspace initialized. All systems nominal.\nReady for input." }
  ]);
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
    if (!provider || !model) { setError("No model selected."); return; }

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
      setError((e as Error).message ?? "Error connecting to model.");
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, history, provider, model]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Messages Area */}
      <div
        id="chat-message-list"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 60px",
          display: "flex",
          flexDirection: "column",
          maxWidth: 800,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {history.length === 0 && !loading && <EmptyState />}
        {history.map((msg, i) => <MessageBlock key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "0 auto 16px",
            padding: "8px 16px",
            background: "rgba(255, 0, 0, 0.1)",
            borderLeft: "2px solid rgba(255, 50, 50, 0.5)",
            fontSize: 12,
            color: "rgba(255, 100, 100, 0.9)",
            maxWidth: 680,
            width: "calc(100% - 120px)",
          }}
        >
          {error}
        </div>
      )}

      {/* Minimalist Input Bar */}
      <div
        style={{
          padding: "0 60px 40px",
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 680,
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 4,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
          }}
        >
          <textarea
            id="chat-input"
            ref={textareaRef}
            placeholder="[ type message ]"
            value={input}
            onChange={e => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.9)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              padding: "16px 20px",
              resize: "none",
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 200,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 16,
              bottom: 16,
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
              letterSpacing: "0.05em",
            }}
          >
            ⏎
          </div>
        </div>
      </div>
    </div>
  );
}
