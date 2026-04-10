import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { convertToCredits } from "@/lib/pricing";
import { sendDepositConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify webhook signature
  const signature = req.headers.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");

  if (signature !== hash) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === "charge.success") {
    const { reference, amount, currency } = event.data;
    const originalAmount = amount / 100;
    const cur = (currency as string).toUpperCase() as "NGN" | "USD";

    const supabase = await createClient();

    // Check idempotency
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, status, user_id")
      .eq("reference", reference)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (existing.status === "completed") {
      return NextResponse.json({ message: "Already processed" });
    }

    const credits = await convertToCredits(originalAmount, cur);

    // Credit balance — try RPC, fall back to manual
    let credited = false;

    const { error: rpcError } = await supabase.rpc("credit_balance", {
      p_user_id: existing.user_id,
      p_amount: credits,
    });

    if (!rpcError) {
      credited = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", existing.user_id)
        .single();

      if (profile) {
        const newBalance = Number(profile.credits_balance) + credits;
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ credits_balance: newBalance })
          .eq("id", existing.user_id);

        if (!updateError) credited = true;
      }
    }

    if (!credited) {
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("reference", reference);
      return NextResponse.json({ error: "Failed to credit" }, { status: 500 });
    }

    // Mark completed
    await supabase
      .from("transactions")
      .update({ status: "completed", amount: credits })
      .eq("reference", reference);

    // Send email notification
    const { data: userData } = await supabase.auth.admin.getUserById(existing.user_id);
    if (userData?.user?.email) {
      sendDepositConfirmation(
        userData.user.email,
        originalAmount.toLocaleString(),
        credits,
        cur
      );
    }
  }

  return NextResponse.json({ message: "OK" });
}
