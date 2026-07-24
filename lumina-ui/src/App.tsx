import './index.css';
import { useRef, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import PreviewPanel from './components/PreviewPanel';
import NotifDrawer from './components/NotifDrawer';
import SettingsPanel from './components/SettingsPanel';
import styles from './App.module.css';

export default function App() {
  const state = useAppState();
  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close drawers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (state.notifDrawerOpen && notifRef.current && !notifRef.current.contains(target)) {
        state.setNotifDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state.notifDrawerOpen]);

  const sampleFileContent: Record<string, string> = {
    'implementation_plan.md': `# Implementation Plan\n\nThis document outlines the Lumina architecture.\n\n## Components\n\n- FastAPI backend\n- FastMCP orchestrator\n- React frontend\n\n> [!NOTE]\n> See walkthrough.md for progress.`,
    'walkthrough.md': `# Walkthrough\n\n## What was built\n\n- \`proxy_server.py\` rewritten using \`create_proxy()\` API\n- \`utils.py\` with SDK-agnostic \`LLM\` class\n- React + Vite frontend scaffolded\n\n## Status\n\n| Item | Status |\n|---|---|\n| MCP servers | Done |\n| LLM layer | Done |\n| Frontend | In progress |`,
    'utils.py': `\`\`\`python\n# backend/src/utils.py\nclass LLM:\n    def __init__(self, provider, model=None):\n        self.provider = provider\n        self.model = model or DEFAULT_MODELS[provider]\n\n    async def generate(self, prompt, tools=None, mcp_client=None):\n        return await generate(prompt, tools, mcp_client, provider=self.provider)\n\`\`\``,
    'proxy_server.py': `\`\`\`python\n# backend/servers/proxy_server.py\nfrom fastmcp import FastMCP\nfrom fastmcp.server import create_proxy\nfrom fastmcp.client.transports import PythonStdioTransport\n\norchestrator = FastMCP(name="LuminaOrchestrator")\norchestrator.mount(create_proxy(PythonStdioTransport(...)), namespace="autogui")\norchestrator.mount(create_proxy(PythonStdioTransport(...)), namespace="shell")\norchestrator.run(transport="http", host="127.0.0.1", port=8082)\n\`\`\``,
  };

  return (
    <div className={styles.app}>
      <Topbar
        unreadCount={state.unreadCount}
        notifDrawerOpen={state.notifDrawerOpen}
        onToggleNotif={() => state.setNotifDrawerOpen(o => !o)}
        onToggleSettings={() => state.setSettingsOpen(o => !o)}
        sessionTitle={state.activeConv?.title ?? 'New Session'}
      />

      <div className={styles.body}>
        <Sidebar
          activePanel={state.sidebarPanel}
          onPanelChange={state.setSidebarPanel}
          conversations={state.conversations}
          activeConvId={state.activeConvId}
          onSelectConv={state.setActiveConvId}
          onNewConv={state.newConversation}
          agents={state.agents}
          tools={state.tools}
          onToggleTool={state.toggleTool}
          logs={state.logs}
          memory={state.memory}
          onOpenPreview={(name) => state.openPreview(name, sampleFileContent[name] ?? `# ${name}\n\nNo content available.`)}
        />

        <ChatPanel
          messages={state.activeConv?.messages ?? []}
          isTyping={state.isTyping}
          voiceActive={state.voiceActive}
          onSend={state.sendMessage}
          onToggleVoice={() => state.setVoiceActive(v => !v)}
        />

        <PreviewPanel
          files={state.previewFiles}
          activeFile={state.activePreviewFile}
          onSelectTab={state.setActivePreviewFile}
          onCloseTab={state.closePreviewTab}
        />
      </div>

      {/* Overlays */}
      {state.notifDrawerOpen && (
        <div ref={notifRef}>
          <NotifDrawer
            notifications={state.notifications}
            onDismiss={state.dismissNotification}
            onClearAll={state.clearNotifications}
          />
        </div>
      )}

      {state.settingsOpen && (
        <div ref={settingsRef}>
          <SettingsPanel onClose={() => state.setSettingsOpen(false)} />
        </div>
      )}
    </div>
  );
}
