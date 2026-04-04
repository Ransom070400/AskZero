"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, CreditCard } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function TopNav() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

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

  // Realtime balance
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const channelName = `nav-balance-${Date.now()}`;

    supabase.auth.getUser().then(({ data: { user } }: { data: { user: SupabaseUser | null } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const newBalance = payload.new.credits_balance;
            if (newBalance !== undefined) setBalance(Number(newBalance));
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "AZ";

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <div />

      <div className="flex items-center gap-2">
        {/* Balance */}
        <button
          onClick={() => router.push("/deposit")}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-text-secondary hover:text-foreground transition-colors duration-150"
        >
          <span className="font-medium text-foreground">
            {balance !== null ? `$${(balance / 1000).toFixed(2)}` : "—"}
          </span>
        </button>

        <ThemeToggle />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-surface text-text-secondary text-micro">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end">
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">{user?.email ?? "User"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/deposit")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Deposit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
