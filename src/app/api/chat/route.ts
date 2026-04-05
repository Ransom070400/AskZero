import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deductCredits, checkBalance } from "@/lib/credits";
import { calculateCost } from "@/lib/pricing";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput, validateMessage } from "@/lib/sanitize";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MIN_CREDITS = 5;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { ok } = rateLimit(`chat:${user.id}`, 20);
  if (!ok) return rateLimitResponse();

  const body = await req.json();
  const chatId = body.chatId;
  const message = sanitizeInput(body.message || "");
  const model = body.model;
  const provider = body.provider;

  const { valid, error: validationError } = validateMessage(message);
  if (!valid) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
    });
  }

  if (!provider) {
    return new Response(
      JSON.stringify({ error: "No model selected. Please select a model." }),
      { status: 400 }
    );
  }

  // Check balance
  try {
    const balance = await checkBalance(user.id);
    if (balance < MIN_CREDITS) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          balance,
          depositUrl: "/deposit",
        }),
        { status: 402 }
      );
    }
  } catch {
    // proceed
  }

  // Save user message
  const { error: insertError } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: message,
    token_count: estimateTokens(message),
  });

  if (insertError) {
    return new Response(
      JSON.stringify({ error: "Failed to save message" }),
      { status: 500 }
    );
  }

  // Load conversation history
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messages = (history || []).map(
    (m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })
  );

  // Send to 0G Compute
  let ogResponse: Response;
  try {
    const { sendPrompt } = await import("@/lib/og-compute");
    ogResponse = await sendPrompt(provider, messages, { stream: true });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "0G Compute unavailable";
    return new Response(JSON.stringify({ error: errMsg }), { status: 502 });
  }

  let fullResponse = "";
  const inputTokens = estimateTokens(
    messages.map((m) => m.content).join(" ")
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = ogResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                const chunk = JSON.stringify({ content });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        const errContent =
          err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ content: `\n\n[Error: ${errContent}]` })}\n\n`
          )
        );
      }

      // Calculate cost and deduct
      const outputTokens = estimateTokens(fullResponse);
      const cost = calculateCost(model || "default", inputTokens, outputTokens);
      const actualCost = Math.max(cost, 1);

      try {
        await deductCredits(user.id, actualCost, {
          chat_id: chatId,
          model: model || "unknown",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });
      } catch {
        console.error("Failed to deduct credits after response");
      }

      // Save assistant message
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: fullResponse,
        token_count: outputTokens,
        cost_credits: actualCost,
      });

      // Auto-title
      const { data: chatData } = await supabase
        .from("chats")
        .select("title")
        .eq("id", chatId)
        .single();

      if (chatData?.title === "New Chat") {
        await supabase
          .from("chats")
          .update({ title: message.slice(0, 50) })
          .eq("id", chatId);
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost: actualCost } })}\n\n`
        )
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
