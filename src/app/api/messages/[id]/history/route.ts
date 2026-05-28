import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns the superseded branch ending at the user message with id `id`:
// the soft-deleted user message itself + any soft-deleted messages that
// directly followed it (the original tail before the edit). RLS on
// messages already restricts to the caller's chats.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: anchor, error: anchorErr } = await supabase
    .from("messages")
    .select("id, chat_id, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (anchorErr || !anchor) {
    return NextResponse.json({ messages: [] });
  }

  // Pull the soft-deleted tail starting at the anchor — these are the
  // rows the supersede RPC marked when the user edited.
  const { data: rows } = await supabase
    .from("messages")
    .select("id, role, content, token_count, cost_credits, metadata, created_at")
    .eq("chat_id", anchor.chat_id)
    .gte("created_at", anchor.created_at)
    .not("deleted_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  return NextResponse.json({ messages: rows ?? [] });
}
