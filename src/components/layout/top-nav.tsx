"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { LogOut, Settings, CreditCard } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useEffect, useState, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function TopNav() {
  const router = useRouter();
  const supabase = createClient();
  const { formatBalance } = useCurrency();
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

  // Realtime balance — poll instead of realtime to avoid channel conflicts
  useEffect(() => {
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "AZ";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border md:border-b glass-nav px-3 md:px-6">
      <Link href="/chat" className="hidden md:flex items-center">
        <Logo size={20} />
      </Link>

      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
        {/* Balance */}
        <button
          onClick={() => router.push("/deposit")}
          className="flex items-center gap-1 rounded-lg px-2 md:px-2.5 py-1 text-xs md:text-sm text-text-secondary hover:text-foreground transition-colors duration-150"
        >
          <span className="font-medium text-foreground">
            {balance !== null ? formatBalance(balance) : "—"}
          </span>
        </button>

        <span className="hidden md:block"><ThemeToggle /></span>

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
