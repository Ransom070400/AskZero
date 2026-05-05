import { createClient } from "@supabase/supabase-js";

// Service-role client for trusted server tasks (e.g. the receipt batcher).
// Never import this from a client component or a user-facing route handler
// without first verifying the caller (cron secret, admin email, etc.).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
