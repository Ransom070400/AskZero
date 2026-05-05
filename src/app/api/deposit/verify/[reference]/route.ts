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
  const credits = await convertToCredits(originalAmount, cur);

  const { error: rpcError } = await supabase.rpc("complete_deposit", {
    p_reference: reference,
    p_credits: credits,
  });

  if (rpcError) {
    return NextResponse.json(
      { status: "error", message: "Failed to credit balance" },
      { status: 500 }
    );
  }

  // If the webhook already credited this reference, treat as success — the user got their credits.
  return NextResponse.json({ status: "completed", credits });
}
