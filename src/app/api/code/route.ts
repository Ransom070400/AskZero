import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { checkBalance, deductCredits } from "@/lib/credits";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { runBuild, BUILD_COST, type BuildDepth } from "@/lib/code-build";

export const dynamic = "force-dynamic";
// A build is a multi-step job (plan → write → review → fix → summarize); give it
// room the same way research does.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
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

  const cost = BUILD_COST[depth];
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
        const result = await runBuild(task, depth, send, langHint);

        if (result) {
          // Persist the deliverable into the chat (if any) so it's revisitable.
          if (chatId) {
            await supabase.from("messages").insert({
              chat_id: chatId,
              user_id: user.id,
              role: "assistant",
              content: result.answer,
              metadata: {
                kind: "code",
                depth,
                files: result.files.map((f) => f.path),
              },
            });
          }
          // Charge only on success.
          try {
            await deductCredits(
              user.id,
              cost,
              { kind: "code", depth, task: task.slice(0, 80) },
              supabase
            );
          } catch {
            console.error("deductCredits failed for code build");
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
