"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  Plus,
  Settings,
  X,
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
      {/* Logo */}
      <div className="flex items-center px-5 h-14">
        <Logo size={22} />
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-between"
          onClick={() => router.push("/chat")}
        >
          <span className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            New chat
          </span>
          <kbd className="text-micro text-primary-foreground/50">&#8984;N</kbd>
        </Button>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-2">
          {Object.entries(grouped).map(([date, dateChats]) => (
            <div key={date}>
              <p className="mb-1 px-2 text-micro uppercase text-text-tertiary tracking-widest">
                {date}
              </p>
              <div className="space-y-0.5">
                {dateChats.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-elevated",
                      pathname === `/chat/${chat.id}` &&
                        "bg-elevated text-foreground"
                    )}
                  >
                    <span className="truncate text-text-secondary group-hover:text-foreground">
                      {chat.title}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, chat.id)}
                      className="hidden shrink-0 rounded p-0.5 text-text-tertiary hover:text-error group-hover:block"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-border p-3 space-y-0.5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start gap-2 text-text-secondary",
            pathname === "/deposit" && "bg-elevated text-foreground"
          )}
        >
          <Link href="/deposit">
            <CreditCard className="h-3.5 w-3.5" />
            Deposit
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start gap-2 text-text-secondary",
            pathname === "/settings" && "bg-elevated text-foreground"
          )}
        >
          <Link href="/settings">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
