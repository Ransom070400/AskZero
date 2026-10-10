import { createAdminClient } from "@/lib/supabase/admin";

// Assistant messages are service-role only (users may insert role='user' rows
// and nothing else), so a user can't plant an answer the model never gave.
// The admin client bypasses RLS, so ownership of the chat is checked here.
export async function saveAssistantMessage(
  userId: string,
  chatId: string,
  row: {
    content: string;
    token_count?: number;
    cost_credits?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data: chat } = await admin
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!chat) throw new Error("Chat not found");

  const { data, error } = await admin
    .from("messages")
    .insert({ chat_id: chatId, role: "assistant", ...row })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to save message");
  return data;
}
