import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { convertToCredits } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount } = (await req.json()) as { amount: number };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const credits = convertToCredits(amount, "USD");
  const reference = `stripe_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Save pending transaction
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount: 0,
    currency: "USD",
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
          currency: "usd",
          unit_amount: Math.round(amount * 100), // cents
          product_data: {
            name: `${credits} AskZero Credits`,
            description: `$${amount.toFixed(2)} deposit → ${credits} credits`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      reference,
      credits: String(credits),
    },
    success_url: `${req.nextUrl.origin}/deposit?stripe_ref=${reference}`,
    cancel_url: `${req.nextUrl.origin}/deposit`,
    customer_email: user.email!,
  });

  return NextResponse.json({ url: session.url });
}
