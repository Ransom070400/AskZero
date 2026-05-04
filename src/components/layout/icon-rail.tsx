"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, CreditCard, Settings } from "lucide-react";

const items = [
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: CreditCard, label: "Deposit", href: "/deposit" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around border-t border-border/60 bg-background/85 backdrop-blur-xl px-2 pb-[env(safe-area-inset-bottom,8px)] pt-2">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 transition-colors duration-fast ease-out min-w-[68px]",
              isActive
                ? "text-accent"
                : "text-text-tertiary hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-[22px] w-[22px]", isActive && "drop-shadow-sm")} strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
