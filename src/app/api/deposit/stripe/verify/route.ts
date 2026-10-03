import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendDepositConfirmation } from "@/lib/email";

/**
 * On-return fallback for Stripe Checkout.
 *
 * The Stripe webhook is the canonical path for crediting, but when the
 * webhook isn't reachable (local dev, missing secret, misconfigured endpoint)
 * this endpoint lets the success page verify and credit synchronously.
 *
 * Idempotent: crediting goes through complete_deposit, which only ever flips a
 * pending row once.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return NextResponse.json({
      status: session.payment_status,
      message: "Payment not completed yet",
    });
  }

  const reference = session.metadata?.reference;
  const metaUserId = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits || 0);

  if (!reference || !metaUserId || !credits) {
    return NextResponse.json({ error: "Missing session metadata" }, { status: 400 });
  }

  if (metaUserId !== user.id) {
    return NextResponse.json({ error: "Session does not belong to user" }, { status: 403 });
  }

  // Idempotency check
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
    return NextResponse.json({ status: "completed", credits, alreadyCredited: true });
  }

  // complete_deposit flips the pending row and credits in one statement, so
  // this and the webhook can't both credit. The row was confirmed above to
  // belong to this user.
  const { data: result, error: rpcError } = await createAdminClient().rpc(
    "complete_deposit",
    { p_reference: reference, p_credits: credits }
  );

  if (rpcError) {
    return NextResponse.json(
      { status: "error", message: "Failed to credit balance" },
      { status: 500 }
    );
  }

  if ((result as { credited?: boolean })?.credited !== true) {
    // The webhook got there first — the user already has their credits.
    return NextResponse.json({ status: "completed", credits, alreadyCredited: true });
  }

  // Best-effort email
  try {
    const displayCurrency = (session.metadata?.display_currency || "USD").toUpperCase();
    const zeroDecimal = ["JPY", "KRW", "VND"].includes(displayCurrency);
    const raw = session.amount_total || 0;
    const amountDisplay = zeroDecimal
      ? raw.toLocaleString()
      : (raw / 100).toFixed(2);
    if (user.email) {
      await sendDepositConfirmation(user.email, amountDisplay, credits, displayCurrency);
    }
  } catch {
    // don't fail the credit on email errors
  }

  return NextResponse.json({ status: "completed", credits });
}
