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
import { runBuild, BUILD_COST, type BuildDepth } from "@/lib/code-build";

export const dynamic = "force-dynamic";
// A build is a multi-step job (plan → write → review → fix → summarize); give it
// room the same way research does.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { ok } = rateLimit(`code:${user.id}`, 5);
  if (!ok) return rateLimitResponse();

  const body = await req.json();
  const task = String(body.task ?? "").trim();
  const depth: BuildDepth = body.depth === "standard" ? "standard" : "quick";
  const langHint = typeof body.language === "string" ? body.language : undefined;
  const chatId = body.chatId as string | undefined;

  if (!task) {
    return new Response(JSON.stringify({ error: "task required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Hold the cost up front; it's refunded if the job fails.
  const cost = BUILD_COST[depth];
  let holdId: string;
  try {
    holdId = await reserveCredits(user.id, cost, { kind: "code", depth });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", cost }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("reserveCredits failed for code build", err);
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
            const result = await runBuild(task, depth, send, langHint);

            if (result) {
              succeeded = true;
              // Persist into the chat (if any) so it's revisitable.
              if (chatId) {
                await saveAssistantMessage(user.id, chatId, {
                  content: result.answer,
                  metadata: {
                    kind: "code",
                    depth,
                    files: result.files.map((f) => f.path),
                  },
                }).catch((err) => console.error("Failed to save code build", err));
              }
            }
          } catch (e) {
            console.error("code build failed", e);
            send({ phase: "error", error: "Something went wrong. You weren't charged." });
          } finally {
            // Charge only on success; otherwise the hold is refunded.
            await settleCredits(holdId, succeeded ? cost : 0, { task: task.slice(0, 80) })
              .then(() => succeeded && send({ phase: "settled", cost }))
              .catch((err) => console.error("settleCredits failed for code build", err));
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
