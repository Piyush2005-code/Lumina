import { MessageSquare, FolderOpen, Users, Wrench, Database, Activity } from 'lucide-react';
import type { SidebarPanel, Conversation, AgentStatus, MCPTool } from '../types';
import styles from './Sidebar.module.css';

interface Props {
  activePanel: SidebarPanel;
  onPanelChange: (p: SidebarPanel) => void;
  conversations: Conversation[];
  activeConvId: string;
  onSelectConv: (id: string) => void;
  onNewConv: () => void;
  agents: AgentStatus[];
  tools: MCPTool[];
  onToggleTool: (name: string) => void;
  logs: { level: string; text: string }[];
  memory: { type: string; text: string }[];
  onOpenPreview: (name: string, content: string) => void;
}

const NAV: { id: SidebarPanel; label: string; Icon: React.ElementType }[] = [
  { id: 'chats',  label: 'Chats',  Icon: MessageSquare },
  { id: 'files',  label: 'Files',  Icon: FolderOpen },
  { id: 'agents', label: 'Agents', Icon: Users },
  { id: 'tools',  label: 'Tools',  Icon: Wrench },
  { id: 'memory', label: 'Memory', Icon: Database },
  { id: 'logs',   label: 'Logs',   Icon: Activity },
];

const FILES = [
  { name: 'implementation_plan.md', indent: 1, content: '# Implementation Plan\n\nThis document outlines the Lumina architecture.\n\n## Components\n\n- FastAPI backend\n- FastMCP orchestrator\n- React frontend\n\n> [!NOTE]\n> See walkthrough.md for progress.' },
  { name: 'walkthrough.md', indent: 1, content: '# Walkthrough\n\n## What was built\n\n- `proxy_server.py` rewrote using `create_proxy()` API\n- `utils.py` with SDK-agnostic `LLM` class\n- React + Vite frontend scaffolded\n\n## Status\n\n| Item | Status |\n|---|---|\n| MCP servers | Done |\n| LLM layer | Done |\n| Frontend | In progress |' },
  { name: 'utils.py', indent: 2, content: '```python\n# backend/src/utils.py\n# SDK-agnostic LLM layer\n\nclass LLM:\n    def __init__(self, provider, model=None, ...):\n        self.provider = provider\n        self.model = model or DEFAULT_MODELS[provider]\n\n    async def generate(self, prompt, tools=None, mcp_client=None):\n        return await generate(prompt, tools, mcp_client, provider=self.provider, ...)\n```' },
  { name: 'proxy_server.py', indent: 2, content: '```python\n# backend/servers/proxy_server.py\nfrom fastmcp import FastMCP\nfrom fastmcp.server import create_proxy\nfrom fastmcp.client.transports import PythonStdioTransport\n\norchestrator = FastMCP(name="LuminaOrchestrator")\norchestrator.mount(create_proxy(PythonStdioTransport(...)), namespace="autogui")\norchestrator.mount(create_proxy(PythonStdioTransport(...)), namespace="shell")\norchestrator.run(transport="http", host="127.0.0.1", port=8082)\n```' },
];

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function Sidebar({
  activePanel, onPanelChange, conversations, activeConvId,
  onSelectConv, onNewConv, agents, tools, onToggleTool, logs, memory, onOpenPreview,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`${styles.navItem} ${activePanel === id ? styles.active : ''}`}
            onClick={() => onPanelChange(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.panel}>
        {activePanel === 'chats' && (
          <>
            <div className={styles.sectionLabel}>Conversations</div>
            <div className={styles.chatList}>
              {conversations.map(c => (
                <button
                  key={c.id}
                  className={`${styles.chatEntry} ${c.id === activeConvId ? styles.activeChat : ''}`}
                  onClick={() => onSelectConv(c.id)}
                >
                  <div className={styles.chatTitle}>{c.title}</div>
                  <div className={styles.chatMeta}>{timeAgo(c.ts)}</div>
                </button>
              ))}
            </div>
            <button className={styles.newChatBtn} onClick={onNewConv}>+ New Chat</button>
          </>
        )}

        {activePanel === 'files' && (
          <>
            <div className={styles.sectionLabel}>Workspace</div>
            <div className={styles.fileTree}>
              <div className={styles.fileFolder}>agents-mcp /</div>
              {FILES.map(f => (
                <button
                  key={f.name}
                  className={styles.fileItem}
                  style={{ paddingLeft: f.indent * 14 + 8 }}
                  onClick={() => onOpenPreview(f.name, f.content)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}

        {activePanel === 'agents' && (
          <>
            <div className={styles.sectionLabel}>Agents</div>
            <div className={styles.list}>
              {agents.map(a => (
                <div key={a.name} className={styles.agentCard}>
                  <span className={`${styles.dot} ${styles[a.status]}`} />
                  <div>
                    <div className={styles.agentName}>{a.name}</div>
                    <div className={styles.agentDetail}>{a.status}{a.detail ? ` — ${a.detail}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activePanel === 'tools' && (
          <>
            <div className={styles.sectionLabel}>MCP Tools</div>
            <div className={styles.list}>
              {tools.map(t => (
                <div key={t.name} className={styles.toolCard}>
                  <div className={styles.toolInfo}>
                    <div className={styles.toolName}>{t.name}</div>
                    <div className={styles.toolDesc}>{t.description}</div>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={t.enabled} onChange={() => onToggleTool(t.name)} />
                    <span className={styles.slider} />
                  </label>
                </div>
              ))}
            </div>
          </>
        )}

        {activePanel === 'memory' && (
          <>
            <div className={styles.sectionLabel}>Memory</div>
            <div className={styles.list}>
              {memory.map((m, i) => (
                <div key={i} className={styles.memCard}>
                  <div className={styles.memType}>{m.type}</div>
                  <div className={styles.memText}>{m.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {activePanel === 'logs' && (
          <>
            <div className={styles.sectionLabel}>System Logs</div>
            <div className={styles.logStream}>
              {logs.map((l, i) => (
                <div key={i} className={`${styles.logLine} ${styles[l.level]}`}>{l.text}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
