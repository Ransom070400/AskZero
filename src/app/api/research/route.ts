import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import {
  reserveCredits,
  settleCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { keepAlive } from "@/lib/wait-until";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { saveAssistantMessage } from "@/lib/assistant-message";
import { runResearch, RESEARCH_COST, type ResearchDepth } from "@/lib/research";

export const dynamic = "force-dynamic";
// Research is a multi-step job; give it room (Vercel Pro / Fluid).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();
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

  // Hold the cost up front; it's refunded if the job fails.
  const cost = RESEARCH_COST[depth];
  let holdId: string;
  try {
    holdId = await reserveCredits(user.id, cost, { kind: "research", depth });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", cost }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("reserveCredits failed for research", err);
    return new Response(
      JSON.stringify({ error: "Couldn't start this job. Please try again." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  // The job keeps running (and settles) if the client disconnects; sends to
  // a closed stream are dropped.
  let clientGone = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          clientGone = true;
        }
      };

      keepAlive(
        (async () => {
          let succeeded = false;
          try {
            const result = await runResearch(query, depth, send);

            if (result) {
              succeeded = true;
              // Persist into the chat (if any) so it's revisitable.
              if (chatId) {
                await saveAssistantMessage(user.id, chatId, {
                  content: result.report,
                  metadata: { kind: "research", depth, sources: result.sources },
                }).catch((err) => console.error("Failed to save research report", err));
              }
            }
          } catch (e) {
            console.error("research failed", e);
            send({ phase: "error", error: "Something went wrong. You weren't charged." });
          } finally {
            // Charge only on success; otherwise the hold is refunded.
            await settleCredits(holdId, succeeded ? cost : 0, { query: query.slice(0, 80) })
              .then(() => succeeded && send({ phase: "settled", cost }))
              .catch((err) => console.error("settleCredits failed for research", err));
            if (!clientGone) {
              try {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              } catch {
                // client already gone
              }
            }
          }
        })()
      );
    },
    cancel() {
      clientGone = true;
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
