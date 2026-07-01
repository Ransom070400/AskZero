import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { sendAccountDeletedConfirmation } from "@/lib/email";

export async function DELETE() {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = user.email;

  // Delete in order: messages → chats → transactions → profile
  // (messages cascade from chats, but explicit for clarity)
  const { data: chats } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id);

  if (chats && chats.length > 0) {
    const chatIds = chats.map((c) => c.id);
    await supabase.from("messages").delete().in("chat_id", chatIds);
    await supabase.from("chats").delete().eq("user_id", user.id);
  }

  await supabase.from("transactions").delete().eq("user_id", user.id);
  await supabase.from("profiles").delete().eq("id", user.id);

  // Delete storage files
  const { data: files } = await supabase.storage
    .from("chat-attachments")
    .list(user.id);

  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    await supabase.storage.from("chat-attachments").remove(paths);
  }

  // Delete the auth user (requires service role, handled by cascade if set up)
  // Sign out the user
  await supabase.auth.signOut();

  // Send confirmation email
  if (email) {
    sendAccountDeletedConfirmation(email);
  }

  return NextResponse.json({ message: "Account deleted" });
}
