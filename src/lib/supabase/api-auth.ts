import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Resolve the authenticated user + a Supabase client scoped to them, from EITHER
// a mobile/API `Authorization: Bearer <access_token>` header OR the web session
// cookies. This lets every API route serve both the Next.js web client (cookie
// session) and the React Native app (token session) with no per-route branching.
//
// Drop-in replacement for the old two-liner:
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
// becomes:
//   const { supabase, user } = await getAuthedUser();
//
// The returned client is scoped to the user (RLS applies as them) in both paths.
export async function getAuthedUser(): Promise<{
  supabase: SupabaseClient;
  user: User | null;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // 1) Bearer token — mobile app / programmatic clients.
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const supabase = createSupabaseClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) return { supabase, user };
    // Fall through to cookies if the token was invalid/expired.
  }

  // 2) Cookie session — Next.js web client.
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a context where cookies can't be set — safe to ignore
          // when middleware refreshes the session.
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
