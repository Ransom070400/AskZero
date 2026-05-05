import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set([
  "code",
  "markdown",
  "html",
  "svg",
  "mermaid",
  "react",
]);

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

  const body = await req.json();
  const { chatId, messageId, type, title, language, content } = body as {
    chatId?: string;
    messageId?: string;
    type?: string;
    title?: string;
    language?: string | null;
    content?: string;
  };

  if (!chatId || !messageId || !type || !content) {
    return new Response(
      JSON.stringify({ error: "chatId, messageId, type and content required" }),
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(type)) {
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
    });
  }

  const { data: artifactId, error } = await supabase.rpc("record_artifact", {
    p_chat_id: chatId,
    p_message_id: messageId,
    p_type: type,
    p_title: title ?? "",
    p_language: language ?? null,
    p_content: content,
    p_parent_artifact_id: null,
  });

  if (error || typeof artifactId !== "string") {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Insert failed" }),
      { status: 500 }
    );
  }

  return Response.json({ id: artifactId, type, title: title ?? "" });
}
