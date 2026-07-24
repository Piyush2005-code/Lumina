import { useState, useCallback } from 'react';
import type {
  Conversation, Message, Notification, NotifType,
  SidebarPanel, PreviewFile, AgentStatus, MCPTool,
} from '../types';

const uid = () => Math.random().toString(36).slice(2);

const SAMPLE_CONVERSATIONS: Conversation[] = [
  { id: '1', title: 'New Session', messages: [], ts: new Date() },
  { id: '2', title: 'Automate file backup', messages: [], ts: new Date(Date.now() - 7200000) },
  { id: '3', title: 'GUI automation test', messages: [], ts: new Date(Date.now() - 86400000) },
  { id: '4', title: 'Shell script runner', messages: [], ts: new Date(Date.now() - 172800000) },
];

const SAMPLE_AGENTS: AgentStatus[] = [
  { name: 'Orchestrator', status: 'running', detail: 'port 8082' },
  { name: 'Shell Agent', status: 'idle', detail: 'stdio' },
  { name: 'GUI Agent', status: 'stopped' },
];

const SAMPLE_TOOLS: MCPTool[] = [
  { name: 'command', description: 'Execute shell commands', enabled: true },
  { name: 'move_cursor', description: 'Move mouse cursor', enabled: true },
  { name: 'click', description: 'Click at position', enabled: true },
  { name: 'alert', description: 'Show system alert', enabled: false },
  { name: 'get_size', description: 'Get screen dimensions', enabled: true },
  { name: 'screenshot', description: 'Capture screen', enabled: true },
];

const SAMPLE_LOGS = [
  { level: 'info',  text: '[INFO]  Lumina started on port 8000' },
  { level: 'info',  text: '[INFO]  ShellMCP connected via stdio' },
  { level: 'info',  text: '[INFO]  AutoGUI MCP connected via stdio' },
  { level: 'warn',  text: '[WARN]  ANTHROPIC_API_KEY not set' },
  { level: 'info',  text: '[INFO]  Gemini client initialized' },
  { level: 'debug', text: '[DEBUG] Orchestrator listening on 8082' },
];

const SAMPLE_NOTIFS: Notification[] = [
  { id: '1', type: 'success', title: 'Agent connected', message: 'ShellMCP is online', ts: new Date(Date.now() - 120000), read: false },
  { id: '2', type: 'warning', title: 'API key missing', message: 'ANTHROPIC_API_KEY not found in .env', ts: new Date(Date.now() - 600000), read: false },
  { id: '3', type: 'info',    title: 'Session restored', message: 'Loaded 3 previous conversations', ts: new Date(Date.now() - 3600000), read: false },
];

const SAMPLE_MEMORY = [
  { type: 'Episodic',   text: 'User ran backup script at 14:30' },
  { type: 'Workspace',  text: 'Project: agents-mcp, Python 3.12, FastMCP 3.2.4' },
  { type: 'Semantic',   text: 'User prefers FastAPI over Django' },
  { type: 'Preference', text: 'Provider: Google-GenAI / gemini-2.0-flash' },
];

const README_MD = `# Lumina

Lumina is a local AI agentic orchestration platform.

## Features

- **Multi-provider LLM** — Google Gemini, Anthropic Claude, OpenAI / OpenRouter
- **MCP Tool execution** — Shell, GUI automation, and more
- **Markdown preview** — Renders \`.md\` files with full GFM support
- **Voice mode** — Soft ripple UI for speech input

## Quick Start

\`\`\`bash
cd backend
python servers/proxy_server.py   # start MCP orchestrator
uvicorn src.main:app --reload    # start FastAPI backend
\`\`\`

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend  | FastAPI (Python) |
| Agents   | FastMCP 3.x |
| LLM      | google-genai / anthropic / openai |

> [!NOTE]
> This is an offline-first platform. All data stays on your machine.

> [!WARNING]
> Set API keys in \`.env\` before starting.
`;

export function useAppState() {
  const [conversations, setConversations] = useState<Conversation[]>(SAMPLE_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState('1');
  const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFS);
  const [agents] = useState<AgentStatus[]>(SAMPLE_AGENTS);
  const [tools, setTools] = useState<MCPTool[]>(SAMPLE_TOOLS);
  const [logs] = useState(SAMPLE_LOGS);
  const [memory] = useState(SAMPLE_MEMORY);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('chats');
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([{ name: 'README.md', content: README_MD }]);
  const [activePreviewFile, setActivePreviewFile] = useState<string | null>('README.md');
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConvId) ?? conversations[0];
  const unreadCount = notifications.filter(n => !n.read).length;

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { id: uid(), role: 'user', content: text, ts: new Date() };

    setConversations(prev => prev.map(c =>
      c.id === activeConvId ? { ...c, title: c.messages.length === 0 ? text.slice(0, 36) : c.title, messages: [...c.messages, userMsg] } : c
    ));

    setIsTyping(true);

    // Simulate tool call + assistant response
    await new Promise(r => setTimeout(r, 900));

    const toolCall = text.toLowerCase().includes('ls') || text.toLowerCase().includes('list') || text.toLowerCase().includes('run') || text.toLowerCase().includes('shell') || text.toLowerCase().includes('command') ? {
      id: uid(),
      name: 'command',
      args: { cmd: text.includes('ls') ? 'ls -la ~' : 'echo "Done"' },
      status: 'running' as const,
    } : undefined;

    if (toolCall) {
      const toolMsg: Message = { id: uid(), role: 'assistant', content: '', toolCalls: [toolCall], ts: new Date() };
      setConversations(prev => prev.map(c =>
        c.id === activeConvId ? { ...c, messages: [...c.messages, toolMsg] } : c
      ));
      await new Promise(r => setTimeout(r, 1200));
      // Mark tool done
      setConversations(prev => prev.map(c =>
        c.id === activeConvId ? {
          ...c, messages: c.messages.map(m =>
            m.id === toolMsg.id ? {
              ...m, toolCalls: m.toolCalls?.map(tc => ({ ...tc, status: 'done' as const, output: 'drwxr-xr-x  45 piyush  staff   1440 Jun  8 18:24 .\ndrwxr-xr-x   6 piyush  staff    192 Jun  7 12:10 ..\n-rw-r--r--   1 piyush  staff   3820 Jun  8 17:30 .env\ndrwxr-xr-x   8 piyush  staff    256 Jun  8 18:20 backend\ndrwxr-xr-x   4 piyush  staff    128 Jun  8 18:24 lumina-ui' }))
            } : m
          )
        } : c
      ));
    }

    const replies: Record<string, string> = {
      default: "I've processed your request. Is there anything else you'd like me to help with?",
      ls: "I ran `ls -la ~` and found your home directory contents above. You have the agents-mcp project and several config files.",
      list: "I can see your Python files. The main ones are `backend/src/utils.py` (LLM layer), `backend/servers/proxy_server.py` (MCP orchestrator), and the individual MCP server scripts.",
      cursor: "Done. I moved the cursor to the center of the screen using the `move_cursor` MCP tool.",
      screen: "Your screen is **2560 × 1600** pixels (Retina display). The center point is at `(1280, 800)`.",
      automate: "I can automate that for you. Let me set up the task using the Shell and GUI automation tools.",
    };

    const key = Object.keys(replies).find(k => text.toLowerCase().includes(k)) ?? 'default';
    const replyText = replies[key as keyof typeof replies] ?? replies.default;

    const assistantMsg: Message = { id: uid(), role: 'assistant', content: replyText, ts: new Date() };
    setConversations(prev => prev.map(c =>
      c.id === activeConvId ? { ...c, messages: [...c.messages, assistantMsg] } : c
    ));
    setIsTyping(false);
  }, [activeConvId]);

  const newConversation = useCallback(() => {
    const id = uid();
    const conv: Conversation = { id, title: 'New Session', messages: [], ts: new Date() };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(id);
  }, []);

  const addNotification = useCallback((type: NotifType, title: string, message: string) => {
    const n: Notification = { id: uid(), type, title, message, ts: new Date(), read: false };
    setNotifications(prev => [n, ...prev]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const openPreview = useCallback((name: string, content: string) => {
    setPreviewFiles(prev => prev.some(f => f.name === name) ? prev : [...prev, { name, content }]);
    setActivePreviewFile(name);
  }, []);

  const closePreviewTab = useCallback((name: string) => {
    setPreviewFiles(prev => {
      const next = prev.filter(f => f.name !== name);
      setActivePreviewFile(next.length > 0 ? next[next.length - 1].name : null);
      return next;
    });
  }, []);

  const toggleTool = useCallback((name: string) => {
    setTools(prev => prev.map(t => t.name === name ? { ...t, enabled: !t.enabled } : t));
  }, []);

  return {
    conversations, activeConv, activeConvId, setActiveConvId,
    notifications, unreadCount, agents, tools, logs, memory,
    sidebarPanel, setSidebarPanel,
    previewFiles, activePreviewFile, setActivePreviewFile,
    notifDrawerOpen, setNotifDrawerOpen,
    settingsOpen, setSettingsOpen,
    voiceActive, setVoiceActive,
    isTyping,
    sendMessage, newConversation,
    addNotification, dismissNotification, clearNotifications,
    openPreview, closePreviewTab, toggleTool,
  };
}
