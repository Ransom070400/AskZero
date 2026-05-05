import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { data: artifact, error } = await supabase
    .from("artifacts")
    .select(
      "id, message_id, chat_id, type, title, language, content, version, parent_artifact_id, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
  if (!artifact) {
    return new Response(JSON.stringify({ error: "Artifact not found" }), {
      status: 404,
    });
  }

  // Versions in the same chain (siblings + ancestors)
  const rootId = artifact.parent_artifact_id ?? artifact.id;
  const { data: versions } = await supabase
    .from("artifacts")
    .select("id, version, created_at, message_id")
    .or(`id.eq.${rootId},parent_artifact_id.eq.${rootId}`)
    .order("version", { ascending: true });

  return Response.json({ artifact, versions: versions ?? [] });
}
