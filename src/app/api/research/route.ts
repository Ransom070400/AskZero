import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { checkBalance, deductCredits } from "@/lib/credits";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { runResearch, RESEARCH_COST, type ResearchDepth } from "@/lib/research";

export const dynamic = "force-dynamic";
// Research is a multi-step job; give it room (Vercel Pro / Fluid).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { ok } = rateLimit(`research:${user.id}`, 5);
  if (!ok) return rateLimitResponse();

  const body = await req.json();
  const query = String(body.query ?? "").trim();
  const depth: ResearchDepth = body.depth === "standard" ? "standard" : "quick";
  const chatId = body.chatId as string | undefined;

  if (!query) {
    return new Response(JSON.stringify({ error: "query required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cost = RESEARCH_COST[depth];
  const balance = await checkBalance(user.id, supabase);
  if (balance < cost) {
    return new Response(
      JSON.stringify({ error: "Insufficient credits", cost, balance }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const result = await runResearch(query, depth, send);

        if (result) {
          // Persist the report into the chat (if any) so it's revisitable.
          if (chatId) {
            await supabase.from("messages").insert({
              chat_id: chatId,
              user_id: user.id,
              role: "assistant",
              content: result.report,
              metadata: { kind: "research", depth, sources: result.sources },
            });
          }
          // Charge only on success.
          try {
            await deductCredits(
              user.id,
              cost,
              { kind: "research", depth, query: query.slice(0, 80) },
              supabase
            );
          } catch {
            console.error("deductCredits failed for research");
          }
          send({ phase: "settled", cost });
        }
      } catch (e) {
        send({ phase: "error", error: (e as Error).message });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
