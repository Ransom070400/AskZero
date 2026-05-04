import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deductCredits, checkBalance } from "@/lib/credits";
import { calculateCost } from "@/lib/pricing";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput, validateMessage } from "@/lib/sanitize";
import { sendLowBalanceWarning } from "@/lib/email";
import {
  INTEGRATE_PREFIX,
  findIntegrateModel,
  sendIntegratePrompt,
} from "@/lib/integrate-network";

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
  const attachments = body.attachments || [];

  const hasAttachments = attachments.length > 0;
  if (!hasAttachments) {
    const { valid, error: validationError } = validateMessage(message);
    if (!valid) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }
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
  const metadata = attachments.length > 0 ? { attachments } : {};
  const { error: insertError } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: message,
    token_count: estimateTokens(message),
    metadata,
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
    .select("role, content, metadata")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messages = (history || []).map(
    (m: { role: string; content: string; metadata?: { attachments?: { type: string; url: string }[] } }) => {
      const imgAtts = (m.metadata?.attachments || []).filter((a) =>
        a.type.startsWith("image/")
      );

      if (imgAtts.length > 0 && m.role === "user") {
        return {
          role: m.role as "user" | "assistant" | "system",
          content: [
            { type: "text" as const, text: m.content },
            ...imgAtts.map((a) => ({
              type: "image_url" as const,
              image_url: { url: a.url },
            })),
          ],
        };
      }

      return {
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      };
    }
  );

  // Send to 0G Compute (broker SDK) or Integrate Network proxy
  let ogResponse: Response;
  try {
    if (provider.startsWith(INTEGRATE_PREFIX)) {
      const integrateModel = findIntegrateModel(provider);
      if (!integrateModel) {
        return new Response(
          JSON.stringify({ error: "Unknown integrate model" }),
          { status: 400 }
        );
      }
      ogResponse = await sendIntegratePrompt(integrateModel, messages, {
        stream: true,
      });
    } else {
      const { sendPrompt } = await import("@/lib/og-compute");
      ogResponse = await sendPrompt(provider, messages, { stream: true });
    }
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "0G Compute unavailable";
    return new Response(JSON.stringify({ error: errMsg }), { status: 502 });
  }

  let fullResponse = "";
  const inputTokens = estimateTokens(
    messages
      .map((m) =>
        typeof m.content === "string"
          ? m.content
          : m.content
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join(" ")
      )
      .join(" ")
  ) + (attachments.length * 85); // ~85 tokens per image

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

      const LOW_BALANCE_THRESHOLD = 50;
      try {
        const newBalance = await deductCredits(user.id, actualCost, {
          chat_id: chatId,
          model: model || "unknown",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });

        if (newBalance < LOW_BALANCE_THRESHOLD && user.email) {
          sendLowBalanceWarning(user.email, newBalance);
        }
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
