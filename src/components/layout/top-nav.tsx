"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, CreditCard, EyeOff, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { AccountPill } from "@/components/layout/account-pill";
import { ExitIncognito } from "@/components/chat/exit-incognito";
import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function TopNav() {
  const router = useRouter();
  const inIncognito = usePathname()?.startsWith("/chat/incognito") ?? false;
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: SupabaseUser | null } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

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
        {/* Incognito toggle — start an ephemeral chat (not saved, not
            remembered), or leave one (confirming first if it has messages). */}
        {inIncognito ? (
          <ExitIncognito>
            <button
              title="Exit incognito"
              aria-label="Exit incognito"
              aria-pressed
              className="press flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-accent-muted text-accent transition-[border-color] duration-fast ease-out hover:border-accent"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </ExitIncognito>
        ) : (
          <button
            onClick={() => router.push("/chat/incognito")}
            title="Incognito chat — not saved, not remembered"
            aria-label="Start incognito chat"
            aria-pressed={false}
            className="press flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors duration-fast ease-out hover:bg-elevated hover:text-foreground"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        )}

        <AccountPill />

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
                  <AvatarFallback className="bg-elevated text-text-secondary text-2xs font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate text-foreground">
                {user?.email ?? "User"}
              </p>
              <p className="text-2xs text-text-tertiary mt-0.5">
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
            <ThemeRow />
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

const THEMES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

// Theme lives in the account menu as a segmented row rather than taking a
// top-bar slot of its own.
function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "system" : null;

  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className="text-sm font-medium text-foreground">Theme</span>
      <div className="flex rounded-lg bg-surface p-0.5">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            aria-pressed={current === value}
            title={label}
            className={cn(
              "press flex h-6 w-7 items-center justify-center rounded-md transition-colors duration-fast",
              current === value
                ? "bg-elevated text-foreground shadow-sm"
                : "text-text-tertiary hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
