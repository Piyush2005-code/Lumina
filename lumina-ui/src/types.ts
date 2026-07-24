export type Provider = 'Google-GenAI' | 'OpenAI' | 'Anthropic';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  status: 'running' | 'done' | 'error';
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  ts: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  ts: Date;
}

export type NotifType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  ts: Date;
  read: boolean;
}

export interface AgentStatus {
  name: string;
  status: 'running' | 'idle' | 'stopped';
  detail?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  enabled: boolean;
}

export interface PreviewFile {
  name: string;
  content: string;
}

export type SidebarPanel = 'chats' | 'files' | 'agents' | 'tools' | 'memory' | 'logs';
