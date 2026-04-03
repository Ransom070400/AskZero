"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  Wallet,
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

  // Fetch on mount and when path changes (new chat created, etc.)
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

  const handleNewChat = () => {
    router.push("/chat");
  };

  const grouped = groupChatsByDate(chats);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/50 bg-sidebar">
      {/* Brand Header */}
      <div className="flex items-center gap-2 px-4 py-5">
        <MessageSquare className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">AskZero</span>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-border/50"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-2">
          {Object.entries(grouped).map(([date, dateChats]) => (
            <div key={date}>
              <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                {date}
              </p>
              <div className="space-y-0.5">
                {dateChats.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      pathname === `/chat/${chat.id}` &&
                        "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="truncate">{chat.title}</span>
                    <button
                      onClick={(e) => handleDelete(e, chat.id)}
                      className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Nav */}
      <div className="border-t border-border/50 p-3 space-y-1">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            pathname === "/deposit" && "bg-sidebar-accent"
          )}
        >
          <Link href="/deposit">
            <Wallet className="h-4 w-4" />
            Deposit
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            pathname === "/settings" && "bg-sidebar-accent"
          )}
        >
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
