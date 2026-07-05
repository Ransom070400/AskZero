import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { getStripe } from "@/lib/stripe";
import { convertToCredits } from "@/lib/pricing";
import {
  apacToCredits,
  isApacCurrency,
  toStripeUnitAmount,
  APAC_CURRENCIES,
} from "@/lib/pricing-apac";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, currency: rawCurrency } = (await req.json()) as {
    amount: number;
    currency?: string;
  };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const currency = (rawCurrency || "USD").toUpperCase();

  // Resolve credits, Stripe unit amount, and display metadata per currency.
  let credits: number;
  let unitAmount: number;
  let stripeCurrency: string;
  let productLabel: string;

  if (currency === "USD") {
    credits = await convertToCredits(amount, "USD");
    unitAmount = Math.round(amount * 100);
    stripeCurrency = "usd";
    productLabel = `$${amount.toFixed(2)} deposit`;
  } else if (isApacCurrency(currency)) {
    const meta = APAC_CURRENCIES[currency];
    credits = apacToCredits(amount, currency);
    unitAmount = toStripeUnitAmount(amount, currency);
    stripeCurrency = currency.toLowerCase();
    productLabel = `${meta.symbol}${amount.toLocaleString()} deposit`;
  } else {
    return NextResponse.json(
      { error: `Unsupported currency: ${currency}` },
      { status: 400 }
    );
  }

  if (credits <= 0) {
    return NextResponse.json(
      { error: "Amount too small" },
      { status: 400 }
    );
  }

  const reference = `stripe_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Save pending transaction
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount: 0,
    currency,
    original_amount: amount,
    reference,
    status: "pending",
    metadata: { payment_provider: "stripe" },
  });

  // Create Stripe Checkout session
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: stripeCurrency,
          unit_amount: unitAmount,
          product_data: {
            name: `${credits} AskZero Credits`,
            description: `${productLabel} → ${credits} credits`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      reference,
      credits: String(credits),
      display_currency: currency,
    },
    success_url: `${req.nextUrl.origin}/deposit?stripe_ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.nextUrl.origin}/deposit`,
    customer_email: user.email!,
  });

  // sessionId lets non-web clients (mobile) verify on return.
  return NextResponse.json({ url: session.url, sessionId: session.id, reference });
}
