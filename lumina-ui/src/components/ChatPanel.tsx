import { useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, MicOff, Send, AtSign } from 'lucide-react';
import type { Message, ToolCall } from '../types';
import styles from './ChatPanel.module.css';

interface Props {
  messages: Message[];
  isTyping: boolean;
  voiceActive: boolean;
  onSend: (text: string) => void;
  onToggleVoice: () => void;
  onFillInput?: (text: string) => void;
}

const SUGGESTIONS = [
  'List all Python files in the project',
  'Move the cursor to center of screen',
  'Run ls -la in the home directory',
];

function ToolCallCard({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.toolCard}>
      <button className={styles.toolHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.toolIcon}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </span>
        <span className={styles.toolName}>{tc.name}</span>
        <span className={`${styles.toolBadge} ${styles[tc.status]}`}>{tc.status}</span>
        <span className={styles.toolChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.toolBody}>
          <div className={styles.toolSection}>
            <span className={styles.toolSectionLabel}>Input</span>
            <pre className={styles.toolCode}>{JSON.stringify(tc.args, null, 2)}</pre>
          </div>
          {tc.output && (
            <div className={styles.toolSection}>
              <span className={styles.toolSectionLabel}>Output</span>
              <pre className={`${styles.toolCode} ${tc.status === 'running' ? styles.shimmer : ''}`}>{tc.output}</pre>
            </div>
          )}
          {tc.status === 'running' && !tc.output && (
            <div className={`${styles.toolRunning} ${styles.shimmer}`}>Running…</div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}>
      <div className={styles.role}>{isUser ? 'You' : 'Lumina'}</div>
      {msg.content && <div className={styles.bubble}>{msg.content}</div>}
      {msg.toolCalls?.map(tc => <ToolCallCard key={tc.id} tc={tc} />)}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className={`${styles.message} ${styles.assistant}`}>
      <div className={styles.role}>Lumina</div>
      <div className={styles.bubble}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}

function VoiceRipple({ onExit }: { onExit: () => void }) {
  return (
    <div className={styles.voiceArea}>
      <div className={styles.rippleWrap}>
        {[1,2,3,4].map(i => <span key={i} className={styles.ring} style={{ animationDelay: `${(i-1)*0.4}s` }} />)}
        <span className={styles.orb} />
      </div>
      <p className={styles.voiceLabel}>Listening…</p>
      <button className={styles.voiceCancel} onClick={onExit}>Cancel</button>
    </div>
  );
}

export default function ChatPanel({ messages, isTyping, voiceActive, onSend, onToggleVoice }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const autoResize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  const submit = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const fill = (text: string) => {
    setInput(text);
    taRef.current?.focus();
  };

  return (
    <main className={styles.panel}>
      <div className={styles.messages}>
        {isEmpty && (
          <div className={styles.welcome}>
            <img src="/logo.png" alt="Lumina" className={styles.welcomeLogo} />
            <h1 className={styles.welcomeTitle}>Good evening, Piyush</h1>
            <p className={styles.welcomeSub}>Lumina is ready. What would you like to automate?</p>
            <div className={styles.chips}>
              {SUGGESTIONS.map(s => (
                <button key={s} className={styles.chip} onClick={() => fill(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {voiceActive && <VoiceRipple onExit={onToggleVoice} />}

      <div className={styles.inputBar}>
        <div className={styles.inputCard}>
          <textarea
            ref={taRef}
            className={styles.textarea}
            placeholder="Ask Lumina anything…"
            value={input}
            rows={1}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKey}
          />
          <div className={styles.actions}>
            <div className={styles.actLeft}>
              <button className={styles.actionBtn} title="Attach"><Paperclip size={14} /></button>
              <button className={styles.actionBtn} title="Mention">@<AtSign size={13} /></button>
            </div>
            <div className={styles.actRight}>
              <button
                className={`${styles.actionBtn} ${voiceActive ? styles.micActive : ''}`}
                onClick={onToggleVoice}
                title="Voice"
              >
                {voiceActive ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button className={styles.sendBtn} onClick={submit} title="Send">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
