"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/auth/google-signin";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
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
            welcome back
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed max-w-[320px] mx-auto">
            sign in to continue your private, verifiable AI conversations.
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
      <form onSubmit={handleEmailLogin} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/login"
              className="text-[12px] font-medium text-text-tertiary hover:text-accent transition-colors duration-fast"
            >
              forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
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
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-text-secondary">
        New to AskZero?{" "}
        <Link
          href="/signup"
          className="font-semibold text-foreground hover:text-accent transition-colors duration-fast underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
