import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { checkBalance } from "@/lib/credits";

export async function GET() {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const balance = await checkBalance(user.id, supabase);
    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
