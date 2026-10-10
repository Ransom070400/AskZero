import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import {
  reserveCredits,
  settleCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitize";
import { saveAssistantMessage } from "@/lib/assistant-message";
import {
  generateImage,
  imageGenCostCredits,
  isImageGenConfigured,
} from "@/lib/image-generation";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { ok } = rateLimit(`image:${user.id}`, 10);
  if (!ok) return rateLimitResponse();

  if (!isImageGenConfigured()) {
    return new Response(
      JSON.stringify({ error: "Image generation is not configured" }),
      { status: 503 }
    );
  }

  const body = await req.json();
  const chatId = body.chatId as string | undefined;
  const prompt = sanitizeInput((body.prompt as string | undefined) ?? "").trim();
  const size = (body.size as string | undefined) ?? "1024x1024";

  if (!chatId || !prompt) {
    return new Response(
      JSON.stringify({ error: "chatId and prompt are required" }),
      { status: 400 }
    );
  }

  // Hold the cost up front; it's refunded unless the image is generated and
  // saved (see the finally below).
  const cost = imageGenCostCredits();
  let holdId: string;
  try {
    holdId = await reserveCredits(user.id, cost, { chat_id: chatId, kind: "image" });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", depositUrl: "/deposit" }),
        { status: 402 }
      );
    }
    console.error("reserveCredits failed for image generation", err);
    return new Response(
      JSON.stringify({ error: "Image generation is unavailable right now" }),
      { status: 503 }
    );
  }

  let delivered = false;
  let upstreamModel: string | undefined;
  try {
    // Persist the user prompt as a message
    const { data: userMsg, error: userMsgErr } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: `/image ${prompt}`,
        token_count: 0,
      })
      .select("id, content")
      .single();
    if (userMsgErr || !userMsg) {
      return new Response(
        JSON.stringify({ error: "Failed to save prompt" }),
        { status: 500 }
      );
    }

    // Generate
    let image;
    try {
      image = await generateImage({ prompt, size });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image generation failed";
      return new Response(JSON.stringify({ error: message }), { status: 502 });
    }

    // Upload to chat-attachments bucket
    const path = `${user.id}/${chatId}/zimg-${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, image.bytes, {
        contentType: image.contentType,
        upsert: false,
      });
    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadErr.message}` }),
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-attachments").getPublicUrl(path);

    const attachment = {
      name: "z-image.png",
      type: image.contentType,
      size: image.bytes.byteLength,
      path,
      url: publicUrl,
    };

    // Persist assistant message holding the image
    const assistantMsg = await saveAssistantMessage(user.id, chatId, {
      content: "",
      token_count: 0,
      cost_credits: cost,
      metadata: { attachments: [attachment] },
    }).catch(() => null);
    if (!assistantMsg) {
      return new Response(
        JSON.stringify({ error: "Failed to save image message" }),
        { status: 500 }
      );
    }

    delivered = true;
    upstreamModel = image.upstreamModel;

    // Auto-title on first image
    const { data: chatData } = await supabase
      .from("chats")
      .select("title")
      .eq("id", chatId)
      .single();
    if (chatData?.title === "New Chat") {
      await supabase
        .from("chats")
        .update({ title: prompt.slice(0, 50) })
        .eq("id", chatId);
    }

    return Response.json({
      userMessageId: userMsg.id,
      assistantMessage: {
        id: assistantMsg.id,
        role: "assistant" as const,
        content: "",
        cost_credits: cost,
        attachments: [attachment],
      },
    });
  } finally {
    await settleCredits(holdId, delivered ? cost : 0, {
      model: upstreamModel,
      prompt_chars: prompt.length,
    }).catch((err) => console.error("settleCredits failed for image generation", err));
  }
}
