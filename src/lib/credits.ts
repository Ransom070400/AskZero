import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// checkBalance reads profiles directly (RLS-scoped), so it takes the caller's
// client: the mobile/API path passes the Bearer-scoped client from
// getAuthedUser() so RLS resolves the same user.
//
// Moving credits is service-role only (see 20261003000000_lock_down_credits.sql),
// so reserveCredits/settleCredits always use the admin client. Callers must pass a
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

// Reserve-then-settle (see 20261010000200_credit_holds.sql): take the
// projected cost before doing paid work, then swap the hold for the real cost.
// reserveCredits throws InsufficientCreditsError when the balance can't cover
// the hold; any other error is a genuine failure.
export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export async function reserveCredits(
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await createAdminClient().rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_metadata: metadata,
  });
  if (error) {
    if (error.message.includes("Insufficient credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(`Failed to reserve credits: ${error.message}`);
  }
  return data as string;
}

export interface Settlement {
  settled: boolean;
  charged?: number;
  shortfall?: number;
  new_balance?: number;
}

// actual = 0 refunds the whole hold (the work failed before producing
// anything billable).
export async function settleCredits(
  holdId: string,
  actual: number,
  metadata: Record<string, unknown> = {}
): Promise<Settlement> {
  const { data, error } = await createAdminClient().rpc("settle_credits", {
    p_hold_id: holdId,
    p_actual: actual,
    p_metadata: metadata,
  });
  if (error) throw new Error(`Failed to settle credits: ${error.message}`);
  return data as Settlement;
}
