"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  FolderOpen,
  Clock,
  Sparkles,
  LayoutGrid,
  Database,
  Users,
  Sun,
  Moon,
  CreditCard,
  Settings,
} from "lucide-react";

const navItems = [
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: FolderOpen, label: "Projects", href: "#", disabled: true },
  { icon: Clock, label: "History", href: "#", disabled: true },
  { icon: Sparkles, label: "Models", href: "#", disabled: true },
  { icon: LayoutGrid, label: "Apps", href: "#", badge: "New", disabled: true },
  { icon: Database, label: "Storage", href: "#", disabled: true },
  { icon: Users, label: "Community", href: "#", badge: "New", disabled: true },
];

export function IconRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [initials, setInitials] = useState("AZ");

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user?.email) {
        setInitials(data.user.email.substring(0, 2).toUpperCase());
      }
    });
  }, []);

  return (
    <>
      {/* Desktop rail */}
      <div className="hidden md:flex h-full w-16 flex-col items-center bg-surface border-r border-border py-4 gap-1">
        {/* Logo */}
        <button
          onClick={() => router.push("/chat")}
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-hover"
        >
          <MessageSquare className="h-4 w-4 text-primary-foreground" />
        </button>

        {/* Nav */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = item.href !== "#" && pathname.startsWith(item.href);
            return (
              <div key={item.label} className="relative group">
                <button
                  onClick={() => !item.disabled && router.push(item.href)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                    isActive
                      ? "bg-elevated text-foreground"
                      : "text-text-secondary hover:bg-elevated/60 hover:text-foreground",
                    item.disabled && "opacity-40 cursor-default"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  <div className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap border border-border shadow-md">
                    {item.label}
                  </div>
                </div>
                {/* Badge */}
                {item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground leading-[14px]">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary hover:bg-elevated/60 hover:text-foreground transition-all duration-150"
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </button>
          )}
          <button
            onClick={() => router.push("/settings")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-text-secondary"
          >
            {initials}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around border-t border-border bg-background/95 backdrop-blur-xl px-1 pb-[env(safe-area-inset-bottom,8px)] pt-2">
        {[
          navItems[0], // Chat
          { icon: CreditCard, label: "Deposit", href: "/deposit" },
          { icon: Settings, label: "Settings", href: "/settings" },
        ].map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors duration-150 min-w-[64px]",
                isActive ? "text-primary" : "text-text-tertiary"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
