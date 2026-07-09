"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast";

// Invisible. When a user lands in the app carrying a referral code (captured
// into the `az_ref` cookie on the signup page), redeem it once their session
// exists, then clear the cookie. Runs regardless of how they signed up
// (email or Google), which is why it lives here and not in the signup handler.
const COOKIE = "az_ref";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function ReferralRedeemer() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = readCookie(COOKIE);
    if (!code) return;
    // Clear immediately so a failed/duplicate attempt never retries in a loop.
    clearCookie(COOKIE);

    (async () => {
      try {
        const res = await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.success(
            `Welcome! You and your friend both earned free credits${
              data.refereeBonus ? ` (+${data.refereeBonus})` : ""
            } 🎉`
          );
        }
        // On failure (already referred, invalid code) stay silent — the cookie
        // is already cleared, so it simply won't try again.
      } catch {
        // network hiccup — ignore
      }
    })();
  }, []);

  return null;
}
