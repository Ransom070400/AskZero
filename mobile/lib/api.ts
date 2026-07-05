// Typed client for the AskZero backend. Every request carries the Supabase
// access token as a Bearer header, which the backend's getAuthedUser() helper
// resolves the same way it resolves the web app's session cookie.
//
// This is the whole point of the mobile app: it talks to the SAME API the web
// app uses — no duplicated business logic, no separate backend.

import { fetch as expoFetch } from "expo/fetch";
import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL — copy .env.example to .env");
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ModelInfo {
  provider: string; // e.g. "integrate:glm-5.1"
  model: string; // e.g. "glm-5.1"
  label: string;
  description: string;
  supportsImages: boolean;
  kind: "chat" | "image";
  source: string;
}

export interface ChatSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

async function jsonGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function getBalance(): Promise<number> {
  const { balance } = await jsonGet<{ balance: number }>("/api/balance");
  return balance;
}

export async function getModels(): Promise<ModelInfo[]> {
  const { models } = await jsonGet<{ models: ModelInfo[] }>("/api/models");
  return models;
}

/** First curated chat model, or a sensible default. */
export async function getDefaultChatModel(): Promise<{
  provider: string;
  model: string;
}> {
  try {
    const models = await getModels();
    const chat = models.find((m) => m.kind === "chat");
    if (chat) return { provider: chat.provider, model: chat.model };
  } catch {
    // fall through to default
  }
  return { provider: "integrate:glm-5.1", model: "glm-5.1" };
}

export async function listChats(): Promise<ChatSummary[]> {
  const { chats } = await jsonGet<{ chats: ChatSummary[] }>("/api/chats");
  return chats;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Load a chat's messages directly via Supabase (RLS scopes to the user).
// Excludes soft-deleted edit branches.
export async function getChatMessages(chatId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, deleted_at")
    .eq("chat_id", chatId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role, content: m.content })) as StoredMessage[];
}

// Deposit (Paystack): initialize → hosted checkout URL, then verify by reference.
export async function initializeDeposit(
  amount: number,
  currency: "NGN" | "USD"
): Promise<{ authorization_url: string; reference: string }> {
  const res = await fetch(`${API_URL}/api/deposit/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ amount, currency }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "init failed" }));
    throw new Error(error || `initialize → ${res.status}`);
  }
  return res.json();
}

export async function verifyDeposit(
  reference: string
): Promise<{ status: string; message?: string }> {
  const res = await fetch(
    `${API_URL}/api/deposit/verify/${encodeURIComponent(reference)}`,
    { headers: await authHeaders() }
  );
  return res.json();
}

// Stripe (card / USD): create a Checkout session → hosted URL, verify by session.
export async function initializeStripe(
  amount: number,
  currency: string
): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${API_URL}/api/deposit/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ amount, currency }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "stripe init failed" }));
    throw new Error(error || `stripe → ${res.status}`);
  }
  const d = await res.json();
  return { url: d.url, sessionId: d.sessionId };
}

export async function verifyStripe(
  sessionId: string
): Promise<{ status: string; message?: string }> {
  const res = await fetch(
    `${API_URL}/api/deposit/stripe/verify?session_id=${encodeURIComponent(sessionId)}`,
    { headers: await authHeaders() }
  );
  return res.json();
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_URL}/api/account/delete`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "delete failed" }));
    throw new Error(error || `delete → ${res.status}`);
  }
}

export async function createChat(): Promise<string> {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`create chat → ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}

export interface Attachment {
  url: string;
  type: string;
  name: string;
  extractedText?: string;
}

interface NativeFile {
  uri: string;
  name: string;
  mimeType: string;
}

function filePart(file: NativeFile) {
  // React Native's FormData file part shape.
  return { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob;
}

// Upload an image/PDF to a chat. Returns its public URL (+ extracted PDF text).
export async function uploadFile(
  chatId: string,
  file: NativeFile
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", filePart(file));
  form.append("chatId", chatId);
  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: await authHeaders(), // don't set Content-Type — RN adds the boundary
    body: form,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "upload failed" }));
    throw new Error(error || `upload → ${res.status}`);
  }
  const d = await res.json();
  return { url: d.url, type: d.type, name: d.name, extractedText: d.extractedText };
}

// Transcribe a recorded audio file → text.
export async function transcribeAudio(file: NativeFile): Promise<string> {
  const form = new FormData();
  form.append("file", filePart(file));
  const res = await fetch(`${API_URL}/api/transcribe`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "transcription failed" }));
    throw new Error(error || `transcribe → ${res.status}`);
  }
  const { text } = await res.json();
  return (text as string) ?? "";
}

// Generate an image from a prompt. Returns the generated image URL.
export async function generateImage(
  chatId: string,
  prompt: string,
  size = "1024x1024"
): Promise<{ imageUrl: string; cost: number }> {
  const res = await fetch(`${API_URL}/api/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ chatId, prompt, size }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "image failed" }));
    throw new Error(error || `image → ${res.status}`);
  }
  const d = await res.json();
  const att = d.assistantMessage?.attachments?.[0];
  return { imageUrl: att?.url ?? "", cost: d.assistantMessage?.cost_credits ?? 0 };
}

// --- Autonomous research ---
export type ResearchDepth = "quick" | "standard";

export interface ResearchSource {
  n: number;
  title: string;
  url: string;
}

export interface ResearchEvent {
  phase: string;
  message?: string;
  queries?: string[];
  sourcesFound?: number;
  read?: number;
  total?: number;
  sourceTitle?: string;
  report?: string;
  sources?: ResearchSource[];
  error?: string;
}

export const RESEARCH_COST: Record<ResearchDepth, number> = {
  quick: 50,
  standard: 200,
};

// Stream a research run; each progress event is delivered via onEvent.
export async function streamResearch(
  query: string,
  depth: ResearchDepth,
  onEvent: (e: ResearchEvent) => void
): Promise<void> {
  const res = await expoFetch(`${API_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ query, depth }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let msg = `research → ${res.status}`;
    try {
      msg = JSON.parse(t).error || msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice("data:".length).trim();
      if (data === "[DONE]" || !data) continue;
      try {
        onEvent(JSON.parse(data));
      } catch {
        // ignore malformed frame
      }
    }
  }
}

// Heuristic "make me an image" detector (mirrors the web detectImageIntent).
export function detectImageIntent(text: string): boolean {
  return /\b(draw|generate|create|make|design|paint|render|sketch)\b[^.?!]*\b(image|picture|photo|logo|art|drawing|illustration|wallpaper|icon|avatar)\b/i.test(
    text
  );
}

export interface StreamChatParams {
  chatId: string;
  message: string;
  provider: string;
  model: string;
  style?: "default" | "concise" | "explanatory" | "code";
  attachments?: Attachment[];
}

export interface StreamFinal {
  usage?: { input_tokens: number; output_tokens: number; cost_credits: number };
  messageId?: string | null;
  artifacts?: unknown[];
}

// A live "thinking" step from the agent loop (shown before the answer).
export interface AgentStep {
  type: "thinking" | "tool" | "tool_result";
  text?: string;
  tool?: string;
  input?: string;
}

/**
 * Stream a chat completion. Delivers agent steps (thinking/tool) via onStep,
 * answer text via onChunk, and resolves with the final usage frame.
 *
 * Backend SSE format:
 *   data: {"type":"thinking"|"tool"|"tool_result", ...}  ← live agent steps
 *   data: {"content":"..."}                              ← answer delta
 *   data: {"usage":...,"messageId":...}                  ← final frame
 *   data: [DONE]
 */
export async function streamChat(
  params: StreamChatParams,
  onChunk: (text: string) => void,
  onStep?: (step: AgentStep) => void
): Promise<StreamFinal> {
  const res = await expoFetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`chat → ${res.status} ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: StreamFinal = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice("data:".length).trim();
      if (data === "[DONE]" || data === "") continue;
      try {
        const parsed = JSON.parse(data);
        if (
          parsed.type === "thinking" ||
          parsed.type === "tool" ||
          parsed.type === "tool_result"
        ) {
          onStep?.(parsed as AgentStep);
        } else if (typeof parsed.content === "string") {
          onChunk(parsed.content);
        } else if (parsed.usage || parsed.messageId !== undefined) {
          final = parsed as StreamFinal;
        }
      } catch {
        // ignore malformed frame
      }
    }
  }

  return final;
}
