"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Client-side Google sign-in via Google Identity Services (GIS) + Supabase
// signInWithIdToken. Google authenticates against OUR OAuth client on OUR
// origin, and Supabase only validates the resulting ID token — so the flow
// never redirects through *.supabase.co (no underlying-domain exposure).
//
// Requires:
//  · NEXT_PUBLIC_GOOGLE_CLIENT_ID (OAuth *Web* client id; this origin listed
//    under "Authorized JavaScript origins")
//  · the same Client ID added to Supabase → Auth → Providers → Google.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GsiId {
  initialize: (config: {
    client_id: string;
    callback: (res: { credential: string }) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
type GsiWindow = Window & { google?: { accounts: { id: GsiId } } };

async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

export function GoogleSignIn({ onError }: { onError?: (msg: string) => void }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const rawNonceRef = useRef<string>("");

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const supabase = createClient();

    const init = async () => {
      const g = (window as GsiWindow).google;
      const el = containerRef.current;
      if (!g || !el || cancelled) return;

      const { raw, hashed } = await makeNonce();
      rawNonceRef.current = raw;

      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        use_fedcm_for_prompt: true,
        nonce: hashed,
        callback: async (res) => {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: res.credential,
            nonce: rawNonceRef.current,
          });
          if (error) {
            onError?.(error.message);
            return;
          }
          router.push("/chat");
          router.refresh();
        },
      });

      g.accounts.id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "center",
        width: Math.min(400, el.clientWidth || 360),
      });
    };

    const SCRIPT_ID = "google-gsi";
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if ((window as GsiWindow).google) init();
      else existing.addEventListener("load", init);
    } else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.id = SCRIPT_ID;
      s.onload = init;
      document.body.appendChild(s);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <div className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-center text-[12px] text-text-tertiary">
        Google sign-in isn&apos;t configured — set{" "}
        <code className="text-foreground">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
      </div>
    );
  }

  // GIS renders its own button into this container.
  return <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />;
}
