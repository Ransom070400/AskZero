import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { sendDepositConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const reference = session.metadata?.reference;
    const credits = Number(session.metadata?.credits || 0);

    if (!userId || !reference || !credits) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabase = await createClient();

    // Idempotency check
    const { data: existing } = await supabase
      .from("transactions")
      .select("status")
      .eq("reference", reference)
      .single();

    if (existing?.status === "completed") {
      return NextResponse.json({ message: "Already processed" });
    }

    // Credit balance — try RPC, fall back to manual
    let credited = false;

    const { error: rpcError } = await supabase.rpc("credit_balance", {
      p_user_id: userId,
      p_amount: credits,
    });

    if (!rpcError) {
      credited = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      if (profile) {
        const newBalance = Number(profile.credits_balance) + credits;
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ credits_balance: newBalance })
          .eq("id", userId);

        if (!updateError) credited = true;
      }
    }

    if (credited) {
      await supabase
        .from("transactions")
        .update({ status: "completed", amount: credits })
        .eq("reference", reference);

      // Send email notification
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        const displayCurrency = (session.metadata?.display_currency || "USD").toUpperCase();
        const zeroDecimal = ["JPY", "KRW", "VND"].includes(displayCurrency);
        const raw = session.amount_total || 0;
        const amountDisplay = zeroDecimal
          ? raw.toLocaleString()
          : (raw / 100).toFixed(2);
        sendDepositConfirmation(
          userData.user.email,
          amountDisplay,
          credits,
          displayCurrency
        );
      }
    }
  }

  return NextResponse.json({ message: "OK" });
}
