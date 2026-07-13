"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, CreditCard, Plus, EyeOff, Flame } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useEffect, useState, useCallback, useRef } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// Smoothly tick a number toward its target (e.g. balance after a top-up).
// Snaps on first value and when the user prefers reduced motion.
function useCountUp(target: number | null, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === null) return;
    const from = prevRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (from === null || reduce) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        prevRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

export function TopNav() {
  const router = useRouter();
  const supabase = createClient();
  const { formatBalance } = useCurrency();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const shownBalance = useCountUp(balance);
  const [avatarError, setAvatarError] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: SupabaseUser | null } }) => {
      setUser(user);
    });
    fetchBalance();
  }, [supabase.auth, fetchBalance]);

  // Realtime balance — poll instead of realtime to avoid channel conflicts
  useEffect(() => {
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Login streak badge. A live streak (claimed today, or yesterday and still
  // claimable) shows the count; a broken streak shows nothing.
  const [streak, setStreak] = useState(0);
  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch("/api/daily");
      if (!res.ok) return;
      const d = await res.json();
      const alive = d.claimed_today || d.next_streak === d.current_streak + 1;
      setStreak(alive ? d.current_streak ?? 0 : 0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchStreak();
    // Refresh the badge the moment the daily reward is claimed.
    const onClaim = () => fetchStreak();
    window.addEventListener("askzero:daily-claimed", onClaim);
    return () => window.removeEventListener("askzero:daily-claimed", onClaim);
  }, [fetchStreak]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "AZ";

  // OAuth (Google) profile photo from user metadata, if present.
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    undefined;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/70 glass-nav px-3 md:px-6">
      <Link href="/chat" className="hidden md:flex items-center">
        <Logo size={20} />
      </Link>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {/* Incognito — start an ephemeral chat (not saved, not remembered) */}
        <button
          onClick={() => router.push("/chat/incognito")}
          title="Incognito chat — not saved, not remembered"
          aria-label="Start incognito chat"
          className="press flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-elevated/80 text-text-tertiary transition-[color,border-color] duration-fast ease-out hover:border-border-strong hover:text-foreground"
        >
          <EyeOff className="h-4 w-4" />
        </button>

        {/* Login streak — always-visible so the streak feels owned */}
        {streak > 0 && (
          <div
            title={`${streak}-day streak — claim your daily reward to keep it going`}
            className="flex items-center gap-1 rounded-full border border-border/70 bg-elevated/80 px-2.5 py-1 text-[13px] font-semibold text-foreground"
          >
            <Flame className="h-3.5 w-3.5 text-accent" />
            <span className="tabular-nums">{streak}</span>
          </div>
        )}

        {/* Balance pill — refined affordance, hover lifts subtly */}
        <button
          onClick={() => router.push("/deposit")}
          className="press group flex items-center gap-1.5 rounded-full border border-border/70 bg-elevated/80 px-3 py-1 text-[13px] font-semibold text-foreground transition-[border-color,background-color,box-shadow] duration-fast ease-out hover:border-border-strong hover:shadow-sm"
        >
          <Plus className="h-3 w-3 text-text-tertiary group-hover:text-accent transition-colors duration-fast" />
          <span className="tabular-nums">
            {balance !== null ? formatBalance(Math.round(shownBalance)) : "—"}
          </span>
        </button>

        <span className="hidden md:block">
          <ThemeToggle />
        </span>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {avatarUrl && !avatarError ? (
                  <AvatarImage
                    src={avatarUrl}
                    alt={user?.email ?? "Profile"}
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <AvatarFallback className="bg-elevated text-text-secondary text-[11px] font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="px-3 py-2">
              <p className="text-[13px] font-medium truncate text-foreground">
                {user?.email ?? "User"}
              </p>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                Signed in
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4 text-text-tertiary" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/deposit")}>
              <CreditCard className="mr-2 h-4 w-4 text-text-tertiary" />
              Deposit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4 text-text-tertiary" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
