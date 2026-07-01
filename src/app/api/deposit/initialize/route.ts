import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, currency } = (await req.json()) as {
    amount: number;
    currency: "NGN" | "USD";
  };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const reference = `askzero_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Amount in smallest currency unit (kobo for NGN, cents for USD)
  const paystackAmount = amount * 100;

  // Save pending transaction
  const { error: txError } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount: 0, // will be updated on completion
    currency,
    original_amount: amount,
    reference,
    status: "pending",
    metadata: { payment_provider: "paystack" },
  });

  if (txError) {
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }

  // Initialize Paystack transaction
  const paystackRes = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: paystackAmount,
        currency,
        reference,
        callback_url: `${req.nextUrl.origin}/deposit?reference=${reference}`,
        metadata: {
          user_id: user.id,
          custom_fields: [
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: user.id,
            },
          ],
        },
      }),
    }
  );

  const paystackData = await paystackRes.json();

  if (!paystackData.status) {
    // Clean up pending transaction
    await supabase.from("transactions").delete().eq("reference", reference);
    return NextResponse.json(
      { error: paystackData.message || "Paystack initialization failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization_url: paystackData.data.authorization_url,
    access_code: paystackData.data.access_code,
    reference,
  });
}
