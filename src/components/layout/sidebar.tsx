"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Logo } from "@/components/ui/logo";
import {
  Plus,
  Settings,
  Trash2,
  CreditCard,
} from "lucide-react";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function groupChatsByDate(chats: Chat[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, Chat[]> = {};

  for (const chat of chats) {
    const chatDate = new Date(chat.updated_at);
    let label: string;
    if (chatDate >= today) label = "Today";
    else if (chatDate >= yesterday) label = "Yesterday";
    else if (chatDate >= lastWeek) label = "Last 7 days";
    else label = "Older";

    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  }

  return groups;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, pathname]);

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;

    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (pathname === `/chat/${chatId}`) {
        router.push("/chat");
      }
    }
  };

  const grouped = groupChatsByDate(chats);

  return (
    <div className="flex h-full w-[260px] flex-col bg-surface">
      {/* Brand */}
      <div className="flex items-center px-5 h-14">
        <Logo size={22} />
      </div>

      {/* New chat — refined macOS-style row, not a heavy filled button */}
      <div className="px-3 pt-1 pb-3">
        <button
          onClick={() => router.push("/chat")}
          className="press group flex w-full items-center justify-between rounded-xl border border-border/70 bg-elevated px-3 py-2 text-[13px] font-semibold text-foreground shadow-sm transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong hover:bg-elevated"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-text-tertiary group-hover:text-accent transition-colors duration-fast" />
            New chat
          </span>
          <kbd className="text-[10px] font-medium tracking-wider text-text-tertiary">⌘N</kbd>
        </button>
      </div>

      {/* Chat history */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-5 py-1">
          {Object.entries(grouped).map(([date, dateChats]) => (
            <div key={date}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                {date}
              </p>
              <div className="space-y-px">
                {dateChats.map((chat) => {
                  const active = pathname === `/chat/${chat.id}`;
                  return (
                    <Link
                      key={chat.id}
                      href={`/chat/${chat.id}`}
                      className={cn(
                        "group/row relative flex items-center justify-between rounded-lg pl-3 pr-1.5 py-1.5 text-[13px] transition-colors duration-fast ease-out",
                        active
                          ? "bg-accent-muted text-foreground"
                          : "text-text-secondary hover:bg-elevated hover:text-foreground"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-accent" />
                      )}
                      <span className="truncate font-medium">{chat.title}</span>
                      <button
                        onClick={(e) => handleDelete(e, chat.id)}
                        aria-label="Delete chat"
                        className="press hidden shrink-0 rounded-md p-1 text-text-tertiary hover:bg-background hover:text-error group-hover/row:flex items-center justify-center transition-colors duration-fast"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer nav */}
      <div className="border-t border-border/60 p-2 space-y-px">
        <SidebarNavLink
          href="/deposit"
          icon={<CreditCard className="h-4 w-4" />}
          active={pathname === "/deposit"}
          label="Deposit"
        />
        <SidebarNavLink
          href="/settings"
          icon={<Settings className="h-4 w-4" />}
          active={pathname === "/settings"}
          label="Settings"
        />
      </div>
    </div>
  );
}

function SidebarNavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg pl-3 pr-3 py-2 text-[13px] font-medium transition-colors duration-fast ease-out",
        active
          ? "bg-accent-muted text-foreground"
          : "text-text-secondary hover:bg-elevated hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-accent" />
      )}
      <span className={cn(active ? "text-accent" : "text-text-tertiary")}>{icon}</span>
      {label}
    </Link>
  );
}
