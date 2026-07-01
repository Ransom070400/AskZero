import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cost per 1K tokens in USD cents (adjust per model)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 0.5, output: 1.5 },
};

// Each helper accepts an optional pre-scoped Supabase client. Web routes and
// webhooks call without it (defaulting to the cookie client); the mobile/API
// path passes the Bearer-scoped client from getAuthedUser() so RLS resolves the
// same user. checkBalance reads profiles directly (RLS-scoped), so passing the
// right client matters most there.
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
  metadata: Record<string, unknown> = {},
  client?: SupabaseClient
): Promise<number> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("deduct_credits", {
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
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_credits", {
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
