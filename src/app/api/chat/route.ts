import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deductCredits } from "@/lib/credits";

const MOCK_RESPONSE =
  "I'm **AskZero**, powered by decentralized AI compute on the **0G network**.\n\nThis is a mock response — real 0G Compute integration coming soon!\n\nHere's what I can help with:\n\n- Answering questions about blockchain and Web3\n- Explaining decentralized AI concepts\n- Writing and debugging code\n- General knowledge queries\n\n```javascript\n// Coming soon: real AI inference\nconst response = await og.compute({\n  model: 'default',\n  prompt: message,\n});\n```\n\nStay tuned for the full experience!";

const CREDITS_PER_MESSAGE = 10;

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

  const { chatId, message } = await req.json();

  if (!chatId || !message) {
    return new Response(JSON.stringify({ error: "Missing chatId or message" }), {
      status: 400,
    });
  }

  // Save user message
  const { error: insertError } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: message,
  });

  if (insertError) {
    return new Response(
      JSON.stringify({ error: "Failed to save message" }),
      { status: 500 }
    );
  }

  // Deduct credits
  try {
    await deductCredits(user.id, CREDITS_PER_MESSAGE, {
      chat_id: chatId,
      type: "chat_message",
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Insufficient credits" }),
      { status: 402 }
    );
  }

  // Stream mock response word by word
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

      // Save assistant message after streaming completes
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: fullResponse,
        cost_credits: CREDITS_PER_MESSAGE,
      });

      // Auto-title: update chat title from first user message
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
