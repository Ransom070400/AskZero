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
    const credits = await convertToCredits(originalAmount, cur);

    const { data: result, error: rpcError } = await supabase.rpc(
      "complete_deposit",
      { p_reference: reference, p_credits: credits }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: "Failed to credit" },
        { status: 500 }
      );
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
        sendDepositConfirmation(
          userData.user.email,
          originalAmount.toLocaleString(),
          credits,
          cur
        );
      }
    }
  }

  return NextResponse.json({ message: "OK" });
}
