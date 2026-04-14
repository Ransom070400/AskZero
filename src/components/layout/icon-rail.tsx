"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, CreditCard, Settings } from "lucide-react";

const items = [
  { icon: MessageSquare, label: "chat", href: "/chat" },
  { icon: CreditCard, label: "deposit", href: "/deposit" },
  { icon: Settings, label: "settings", href: "/settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around border-t border-border bg-background/95 backdrop-blur-xl px-1 pb-[env(safe-area-inset-bottom,8px)] pt-2">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors duration-150 min-w-[64px]",
              isActive ? "text-accent" : "text-text-tertiary"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
