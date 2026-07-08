import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";

export async function GET() {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prefer pinned-first ordering; fall back if the `pinned` column migration
  // (20260708000000_chat_pinned) hasn't been applied yet.
  const primary = await supabase
    .from("chats")
    .select("id, title, created_at, updated_at, pinned")
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (primary.error?.code === "42703") {
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ chats: data });
  }

  if (primary.error) {
    return NextResponse.json({ error: primary.error.message }, { status: 500 });
  }

  return NextResponse.json({ chats: primary.data });
}

export async function POST() {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
