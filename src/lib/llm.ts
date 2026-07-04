// Non-streaming GLM completion over the Integrate Network — used by the research
// orchestrator for its intermediate reasoning steps (plan / read / synthesize).
// Mirrors the call memory.ts:distill already makes.

const MODEL =
  process.env.RESEARCH_MODEL ?? process.env.MEMORY_MODEL ?? "glm-5.1-fp8";

export function llmConfigured(): boolean {
  return Boolean(
    process.env.INTEGRATE_NETWORK_URL && process.env.INTEGRATE_NETWORK_KEY
  );
}

export interface CompleteOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function complete(
  prompt: string,
  opts: CompleteOptions = {}
): Promise<string> {
  const baseUrl = process.env.INTEGRATE_NETWORK_URL;
  const apiKey = process.env.INTEGRATE_NETWORK_KEY;
  if (!baseUrl || !apiKey) throw new Error("Integrate Network not configured");

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
      messages,
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      ...(opts.maxTokens != null ? { max_tokens: opts.maxTokens } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content as string) ?? "";
}

// Pull a JSON array/object out of an LLM response that may wrap it in prose or
// code fences.
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
