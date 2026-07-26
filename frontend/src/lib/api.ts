const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/* ─── Types ─────────────────────────────────────── */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  provider: string;
  model?: string;
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  provider: string;
  model: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow?: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  models: ModelInfo[];
}

export interface ModelsResponse {
  providers: ProviderInfo[];
}

/* ─── API calls ──────────────────────────────────── */

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
  return res.json() as Promise<ModelsResponse>;
}

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error ?? "Chat request failed");
  }
  return res.json() as Promise<ChatResponse>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
