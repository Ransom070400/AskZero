import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const reference = session.metadata?.reference;
    const credits = Number(session.metadata?.credits || 0);

    if (!reference || !credits) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // No user session on a webhook — the admin client does the crediting.
    // complete_deposit flips the pending row and credits in one statement, so a
    // Stripe retry racing the on-return verify route can't credit twice.
    const supabase = createAdminClient();
    const { data: result, error: rpcError } = await supabase.rpc(
      "complete_deposit",
      { p_reference: reference, p_credits: credits }
    );

    if (rpcError) {
      return NextResponse.json({ error: "Failed to credit" }, { status: 500 });
    }

    const credited = (result as { credited?: boolean })?.credited === true;
    const userId = (result as { user_id?: string })?.user_id;

    if (!credited) {
      // Either already processed, or no pending transaction for this reference.
      return NextResponse.json({ message: "Already processed" });
    }

    if (userId) {
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
