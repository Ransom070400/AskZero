// Memory layer — long-term, cross-chat memory backed by 0G Storage.
//
//   recall  : embed the current message, vector-search the user's memories,
//             inject the top matches into the system prompt.
//   commit  : after a reply, distill durable facts from the exchange, store a
//             canonical { memories, transcript } blob on 0G Storage, and mirror
//             the facts (with embeddings) into Postgres for fast recall.
//
// 0G Storage is the store-of-record; Postgres is the searchable, rebuildable
// index. Everything is best-effort — a failure here never breaks chat.

import { embed, toVectorLiteral } from "@/lib/embeddings";
import { putJSON } from "@/lib/og-storage";
import type { ChatMessage } from "@/lib/og-compute";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RecalledMemory {
  id: string;
  content: string;
  similarity: number;
}

// --- recall -------------------------------------------------------------

export async function recallMemories(
  supabase: ServerClient,
  query: string,
  limit = 6
): Promise<RecalledMemory[]> {
  try {
    const vec = await embed(query);
    const { data, error } = await supabase.rpc("match_memories", {
      p_embedding: toVectorLiteral(vec),
      p_limit: limit,
    });
    if (error) {
      console.error("match_memories failed:", error.message);
      return [];
    }
    return (data ?? []) as RecalledMemory[];
  } catch (err) {
    console.error("recallMemories threw:", err);
    return [];
  }
}

// Render recalled memories as a system-prompt block. Empty string when there's
// nothing to inject, so the caller can concatenate unconditionally.
export function formatMemoriesForPrompt(memories: RecalledMemory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.content}`).join("\n");
  return [
    "\n\nWhat you remember about this user (from past conversations; use it",
    "only when relevant, and never claim certainty it no longer warrants):",
    lines,
  ].join("\n");
}

// --- commit -------------------------------------------------------------

const MEMORY_SYSTEM_PROMPT = `You extract durable, long-term facts worth remembering about a user from a single chat exchange.

Return ONLY JSON: {"memories": ["fact 1", "fact 2"]}.

Rules:
- Capture stable facts: preferences, ongoing projects, identity, recurring goals, constraints.
- Each memory is one self-contained sentence, written about the user in third person ("The user ...").
- Do NOT record one-off questions, ephemeral context, or anything already obvious.
- If nothing is worth remembering long-term, return {"memories": []}.
- Maximum 5 memories.`;

function distillBaseUrl(): string | undefined {
  return process.env.INTEGRATE_NETWORK_URL;
}
function distillApiKey(): string | undefined {
  return process.env.INTEGRATE_NETWORK_KEY;
}
function distillModel(): string {
  return process.env.MEMORY_MODEL ?? "glm-5.1-fp8";
}

// Ask the model to pull durable facts out of the latest exchange. Returns []
// on any failure or when there's nothing worth keeping.
async function distill(
  userMessage: string,
  assistantResponse: string
): Promise<string[]> {
  const baseUrl = distillBaseUrl();
  const apiKey = distillApiKey();
  if (!baseUrl || !apiKey || !userMessage.trim()) return [];

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: distillModel(),
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: MEMORY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `User said:\n${userMessage}\n\nAssistant replied:\n${assistantResponse}`,
          },
        ],
      }),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return parseMemories(content);
  } catch (err) {
    console.error("distill threw:", err);
    return [];
  }
}

// Parse the model's JSON, tolerating code fences or surrounding prose.
function parseMemories(content: string): string[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const arr = parsed?.memories;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export interface CommitInput {
  chatId: string;
  userMessage: string;
  assistantResponse: string;
  transcript: ChatMessage[]; // full message array sent to the model
}

// Distill → archive on 0G → mirror into Postgres. Fire-and-forget from the
// chat route; awaiting it is optional. Returns the count of memories written.
export async function commitMemory(
  supabase: ServerClient,
  input: CommitInput
): Promise<number> {
  const facts = await distill(input.userMessage, input.assistantResponse);
  if (facts.length === 0) return 0; // nothing durable — skip the 0G write entirely

  // Canonical store-of-record: one blob holds both the distilled memories and
  // the full transcript (satisfies "memory" + "archive" in a single upload).
  const archive = {
    v: 1,
    chatId: input.chatId,
    memories: facts,
    transcript: input.transcript,
    response: input.assistantResponse,
  };
  const put = await putJSON(archive); // null if storage unavailable
  const rootHash = put?.rootHash ?? null;

  if (rootHash) {
    await supabase
      .rpc("record_chat_archive", {
        p_chat_id: input.chatId,
        p_og_root_hash: rootHash,
        p_og_tx_hash: put?.txHash ?? null,
        p_message_count: input.transcript.length,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error("record_chat_archive failed:", error.message);
      });
  }

  // Mirror each fact into the searchable index, embedded for recall and
  // stamped with the 0G root hash that anchors it.
  let written = 0;
  for (const content of facts) {
    const vec = await embed(content);
    const { error } = await supabase.rpc("record_memory", {
      p_content: content,
      p_embedding: toVectorLiteral(vec),
      p_source_chat_id: input.chatId,
      p_og_root_hash: rootHash,
    });
    if (error) {
      console.error("record_memory failed:", error.message);
    } else {
      written++;
    }
  }
  return written;
}
