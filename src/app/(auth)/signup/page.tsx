"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/auth/google-signin";
import { AlertCircle } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Capture a referral code from the invite link (?ref=CODE) into a cookie.
  // It's redeemed after the session exists (ReferralRedeemer in the dashboard),
  // which covers both email and Google sign-up without touching the signup path.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
      document.cookie = `az_ref=${encodeURIComponent(
        ref.toUpperCase()
      )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, []);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Email confirmation is disabled, so signUp returns an active session —
      // send the user straight into the app, same as login.
      router.push("/chat");
      router.refresh();
    }
  };

  return (
    <div className="w-full max-w-[400px] space-y-9">
      {/* Brand + headline */}
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo size={40} animated />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-foreground">
            create your account
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed max-w-[320px] mx-auto">
            decentralized, verifiable AI. pay with naira, USD, or 0G tokens —
            no subscriptions.
          </p>
        </div>
      </div>

      {/* OAuth — Google Identity Services + signInWithIdToken (no supabase.co redirect) */}
      <GoogleSignIn onError={setError} />

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border/70" />
        <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          or with email
        </span>
        <div className="flex-1 border-t border-border/70" />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <p className="text-[13px] leading-snug text-error">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-[11px] text-text-tertiary leading-relaxed">
          By creating an account you agree to receive updates about AskZero.
          We&apos;ll never share your email.
        </p>
      </form>

      <p className="text-center text-[13px] text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground hover:text-accent transition-colors duration-fast underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
