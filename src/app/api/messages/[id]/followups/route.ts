import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { complete, extractJson, llmConfigured } from "@/lib/llm";

// Suggested follow-up questions for an answer, shown as chips under it.
// Separate from /api/chat so generating them never delays the answer; the
// client asks once the answer has finished. Takes a message id (not free
// text) so this can't be used as a general-purpose completion endpoint.
const SYSTEM = `You suggest follow-up questions for a chat. Given the user's question and the assistant's answer, write 3 short follow-ups the USER would plausibly ask next — each a different direction (deeper, practical, related).

Rules:
- Each under 60 characters, phrased as the user would type it.
- No numbering, no quotes inside, no question about the assistant itself.
- Return ONLY JSON: {"followups": ["…", "…", "…"]}`;

const TIMEOUT_MS = 8000;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { ok } = rateLimit(`followups:${user.id}`, 30);
  if (!ok) return rateLimitResponse();
  if (!llmConfigured()) return Response.json({ followups: [] });

  // RLS limits both reads to the caller's own chats.
  const { data: answer } = await supabase
    .from("messages")
    .select("chat_id, role, content, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!answer || answer.role !== "assistant" || !answer.content?.trim()) {
    return Response.json({ followups: [] });
  }
  const { data: question } = await supabase
    .from("messages")
    .select("content")
    .eq("chat_id", answer.chat_id)
    .eq("role", "user")
    .lt("created_at", answer.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prompt = `QUESTION:\n${(question?.content ?? "").slice(0, 1500)}\n\nANSWER:\n${answer.content.slice(0, 4000)}`;
  try {
    const out = await Promise.race([
      complete(prompt, { system: SYSTEM, temperature: 0.6, maxTokens: 600 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
      ),
    ]);
    const parsed = extractJson<{ followups?: unknown }>(out);
    const followups = Array.isArray(parsed?.followups)
      ? parsed.followups
          .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
          // Strip list markers and wrapping quotes the model sometimes adds.
          .map((f) => f.trim().replace(/^(?:\d+[.)]\s+|[-•*]\s+)?["“']?|["”']$/g, ""))
          .filter((f) => f.length <= 90)
          .slice(0, 3)
      : [];
    return Response.json({ followups });
  } catch {
    return Response.json({ followups: [] });
  }
}
