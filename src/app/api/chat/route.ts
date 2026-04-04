import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deductCredits, checkBalance } from "@/lib/credits";
import { calculateCost } from "@/lib/pricing";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput, validateMessage } from "@/lib/sanitize";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MOCK_RESPONSE =
  "I'm **AskZero**, powered by decentralized AI compute on the **0G network**.\n\nThis is a mock response — real 0G Compute integration coming soon!\n\nHere's what I can help with:\n\n- Answering questions about blockchain and Web3\n- Explaining decentralized AI concepts\n- Writing and debugging code\n- General knowledge queries\n\n```javascript\nconst response = await og.compute({\n  model: 'default',\n  prompt: message,\n});\n```\n\nStay tuned for the full experience!";

const MIN_CREDITS = 5; // minimum credits to start a message

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

  // Rate limit: 20 messages per minute per user
  const { ok } = rateLimit(`chat:${user.id}`, 20);
  if (!ok) return rateLimitResponse();

  const body = await req.json();
  const chatId = body.chatId;
  const message = sanitizeInput(body.message || "");
  const model = body.model;
  const provider = body.provider;

  const { valid, error: validationError } = validateMessage(message);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: validationError }),
      { status: 400 }
    );
  }

  // Check balance before proceeding
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
    // If balance check fails, proceed anyway
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

  // Load conversation history for context
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

  // Try 0G Compute, fall back to mock
  const use0G = !!process.env.ZERO_G_PRIVATE_KEY && !!provider;

  if (use0G) {
    return stream0GResponse(supabase, user.id, chatId, message, messages, provider, model);
  }
  return streamMockResponse(supabase, user.id, chatId, message, model);
}

async function stream0GResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chatId: string,
  userMessage: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  providerAddress: string,
  model: string
) {
  let ogResponse: Response;
  try {
    const { sendPrompt } = await import("@/lib/og-compute");
    ogResponse = await sendPrompt(providerAddress, messages, { stream: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "0G Compute unavailable";
    // Don't deduct credits on provider failure
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 502 }
    );
  }

  let fullResponse = "";
  let outputTokens = 0;
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
                outputTokens++;
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

      // Calculate actual cost and deduct
      outputTokens = estimateTokens(fullResponse);
      const cost = calculateCost(model || "default", inputTokens, outputTokens);
      const actualCost = Math.max(cost, 1); // minimum 1 credit

      try {
        await deductCredits(userId, actualCost, {
          chat_id: chatId,
          model: model || "default",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });
      } catch {
        // Log but don't fail the stream
        console.error("Failed to deduct credits after 0G response");
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
          .update({ title: userMessage.slice(0, 50) })
          .eq("id", chatId);
      }

      // Send usage metadata and done
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

async function streamMockResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chatId: string,
  userMessage: string,
  model: string
) {
  const inputTokens = estimateTokens(userMessage);
  const outputTokens = estimateTokens(MOCK_RESPONSE);
  const cost = calculateCost(model || "default", inputTokens, outputTokens);
  const actualCost = Math.max(cost, 1);

  try {
    await deductCredits(userId, actualCost, {
      chat_id: chatId,
      type: "chat_message",
      model: model || "mock",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Insufficient credits", depositUrl: "/deposit" }),
      { status: 402 }
    );
  }

  const words = MOCK_RESPONSE.split(/(\s+)/);
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      for (const word of words) {
        fullResponse += word;
        const chunk = JSON.stringify({ content: word });
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        await new Promise((r) => setTimeout(r, 30));
      }

      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: fullResponse,
        token_count: outputTokens,
        cost_credits: actualCost,
      });

      const { data: chatData } = await supabase
        .from("chats")
        .select("title")
        .eq("id", chatId)
        .single();

      if (chatData?.title === "New Chat") {
        await supabase
          .from("chats")
          .update({ title: userMessage.slice(0, 50) })
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
