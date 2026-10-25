import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountDeletedConfirmation } from "@/lib/email";

const BUCKET = "chat-attachments";

export async function DELETE() {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = user.email;
  // RLS only lets users delete their own chats, so the rest needs the service
  // role. The caller is verified above and only their own rows are touched.
  const admin = createAdminClient();

  // Storage objects aren't covered by table cascades. Uploads live at
  // <user>/<chat>/<file>, so list each chat folder for its files.
  const storage = admin.storage.from(BUCKET);
  const { data: folders } = await storage.list(user.id, { limit: 1000 });
  const paths: string[] = [];
  for (const entry of folders ?? []) {
    const prefix = `${user.id}/${entry.name}`;
    if (entry.id) {
      paths.push(prefix); // a file directly under the user folder
      continue;
    }
    const { data: files } = await storage.list(prefix, { limit: 1000 });
    for (const f of files ?? []) paths.push(`${prefix}/${f.name}`);
  }
  if (paths.length > 0) {
    const { error } = await storage.remove(paths);
    if (error) console.error("account delete: storage cleanup failed", error);
  }

  // profiles.referred_by has no ON DELETE, so anyone this user referred would
  // block the profile delete.
  const { error: referralErr } = await admin
    .from("profiles")
    .update({ referred_by: null })
    .eq("referred_by", user.id);
  if (referralErr) {
    console.error("account delete: clearing referrals failed", referralErr);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Deleting the auth user cascades to the profile, and from there to chats,
  // messages, transactions, receipts, artifacts and memories.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    console.error("account delete: deleteUser failed", deleteErr);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Clear the session cookies. The user is already gone, so ignore failures.
  await supabase.auth.signOut().catch(() => {});

  if (email) {
    await sendAccountDeletedConfirmation(email);
  }

  return NextResponse.json({ message: "Account deleted" });
}
