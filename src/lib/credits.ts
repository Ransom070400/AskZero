import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cost per 1K tokens in USD cents (adjust per model)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 0.5, output: 1.5 },
};

// checkBalance reads profiles directly (RLS-scoped), so it takes the caller's
// client: the mobile/API path passes the Bearer-scoped client from
// getAuthedUser() so RLS resolves the same user.
//
// Moving credits is service-role only (see 20261003000000_lock_down_credits.sql),
// so deductCredits/addCredits always use the admin client. Callers must pass a
// user id they authenticated server-side — never one taken from the request.
export async function checkBalance(
  userId: string,
  client?: SupabaseClient
): Promise<number> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Failed to fetch balance: ${error.message}`);
  return Number(data.credits_balance);
}

export async function deductCredits(
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<number> {
  const { data, error } = await createAdminClient().rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_metadata: metadata,
  });

  if (error) throw new Error(`Failed to deduct credits: ${error.message}`);
  return Number(data);
}

export async function addCredits(
  userId: string,
  amount: number,
  currency: "NGN" | "USD" | "0G",
  originalAmount: number,
  reference: string
): Promise<number> {
  const { data, error } = await createAdminClient().rpc("add_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_currency: currency,
    p_original_amount: originalAmount,
    p_reference: reference,
  });

  if (error) throw new Error(`Failed to add credits: ${error.message}`);
  return Number(data);
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING.default;
  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

// Format cents to display currency
export async function formatBalance(
  cents: number,
  currency: "NGN" | "USD" = "USD"
): Promise<string> {
  const dollars = cents / 100;
  if (currency === "NGN") {
    const { getNgnPerUsd } = await import("@/lib/exchange-rate");
    const rate = await getNgnPerUsd();
    return `₦${(dollars * rate).toFixed(2)}`;
  }
  return `$${dollars.toFixed(2)}`;
}
