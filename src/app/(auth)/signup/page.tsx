"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, MailCheck } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  if (success) {
    return (
      <div className="w-full max-w-[400px] space-y-7 text-center">
        <div className="flex flex-col items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
            <MailCheck className="h-8 w-8 text-accent" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              check your inbox
            </h2>
            <p className="text-[14px] text-text-secondary leading-relaxed max-w-[320px] mx-auto">
              we sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              click it to activate your account.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

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

      {/* OAuth */}
      <button
        onClick={handleGoogleSignup}
        type="button"
        className="press focus-ring flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-elevated text-[14px] font-semibold text-foreground shadow-sm transition-[border-color,background-color,box-shadow] duration-fast ease-out hover:border-border-strong hover:shadow-md"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border/60" />
        <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          or with email
        </span>
        <div className="flex-1 border-t border-border/60" />
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

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
