import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkBalance } from "@/lib/credits";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const balance = await checkBalance(user.id);
    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
