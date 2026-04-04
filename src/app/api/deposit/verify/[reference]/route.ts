import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { convertToCredits } from "@/lib/pricing";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check existing transaction
  const { data: existing } = await supabase
    .from("transactions")
    .select("status")
    .eq("reference", reference)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (existing.status === "completed") {
    return NextResponse.json({ status: "completed", message: "Already credited" });
  }

  // Verify with Paystack
  const paystackRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const paystackData = await paystackRes.json();

  if (!paystackData.status || paystackData.data.status !== "success") {
    return NextResponse.json(
      { status: "failed", message: "Payment not successful" },
      { status: 400 }
    );
  }

  const { amount, currency } = paystackData.data;
  const originalAmount = amount / 100;
  const cur = (currency as string).toUpperCase() as "NGN" | "USD";
  const credits = convertToCredits(originalAmount, cur);

  // Mark transaction as completed FIRST (prevents double-credit on retry)
  const { data: updated, error: markError } = await supabase
    .from("transactions")
    .update({ status: "completed", amount: credits })
    .eq("reference", reference)
    .eq("status", "pending")
    .select("id")
    .single();

  // If no row was updated, it was already completed — don't credit again
  if (markError || !updated) {
    return NextResponse.json({ status: "completed", message: "Already credited" });
  }

  // Credit the user's balance — try RPC first, fall back to manual update
  let credited = false;

  const { error: rpcError } = await supabase.rpc("credit_balance", {
    p_user_id: user.id,
    p_amount: credits,
  });

  if (!rpcError) {
    credited = true;
  } else {
    // Fallback: read current balance and update directly
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    if (profile) {
      const newBalance = Number(profile.credits_balance) + credits;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ credits_balance: newBalance })
        .eq("id", user.id);

      if (!updateError) credited = true;
    }
  }

  if (!credited) {
    return NextResponse.json(
      { status: "error", message: "Failed to credit balance" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "completed", credits });
}
