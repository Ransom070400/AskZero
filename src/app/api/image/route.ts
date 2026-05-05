import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkBalance, deductCredits } from "@/lib/credits";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitize";
import {
  generateImage,
  imageGenCostCredits,
  isImageGenConfigured,
} from "@/lib/image-generation";

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

  const cost = imageGenCostCredits();
  const balance = await checkBalance(user.id);
  if (balance < cost) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits",
        balance,
        depositUrl: "/deposit",
      }),
      { status: 402 }
    );
  }

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
  const path = `${user.id}/${chatId}/zimg-${Date.now()}.png`;
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
  const { data: assistantMsg, error: assistantErr } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      role: "assistant",
      content: "",
      token_count: 0,
      cost_credits: cost,
      metadata: { attachments: [attachment] },
    })
    .select("id")
    .single();
  if (assistantErr || !assistantMsg) {
    return new Response(
      JSON.stringify({ error: "Failed to save image message" }),
      { status: 500 }
    );
  }

  try {
    await deductCredits(user.id, cost, {
      chat_id: chatId,
      kind: "image",
      model: image.upstreamModel,
      prompt_chars: prompt.length,
    });
  } catch {
    // Already inserted the message — log but don't fail the response.
    console.error("deductCredits failed for image generation");
  }

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
}
