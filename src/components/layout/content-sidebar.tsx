"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Sparkles,
  Search,
  X,
  ChevronDown,
  Star,
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
    const d = new Date(chat.updated_at);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= lastWeek) label = "Last 7 days";
    else label = "Older";
    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  }
  return groups;
}

function ChatItem({
  chat,
  isActive,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const initial = chat.title.charAt(0).toUpperCase();
  const colors = [
    "bg-accent/10 text-accent",
    "bg-foreground/10 text-foreground",
    "bg-accent/15 text-accent",
    "bg-foreground/8 text-foreground",
    "bg-accent/20 text-accent",
  ];
  const colorClass = colors[chat.id.charCodeAt(0) % colors.length];

  return (
    <Link
      href={`/chat/${chat.id}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150",
        isActive
          ? "bg-elevated text-foreground"
          : "text-text-secondary hover:bg-elevated/60 hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
          colorClass
        )}
      >
        {initial}
      </span>
      <span className="flex-1 truncate text-sm">{chat.title}</span>
      <button
        onClick={onDelete}
        className="hidden shrink-0 rounded-md p-0.5 text-text-tertiary hover:text-error group-hover:block"
      >
        <X className="h-3 w-3" />
      </button>
    </Link>
  );
}

export function ContentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
      if (pathname === `/chat/${chatId}`) router.push("/chat");
    }
  };

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const grouped = groupChatsByDate(chats);

  return (
    <div className="hidden md:flex h-full w-[280px] flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h2 className="text-lg font-semibold">Chat</h2>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-elevated transition-colors duration-150">
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-3">
        <button
          onClick={() => router.push("/chat")}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New Chat
          <Sparkles className="h-3.5 w-3.5 opacity-50" />
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="space-y-4">
          {Object.entries(grouped).map(([label, dateChats]) => (
            <div key={label}>
              <button
                onClick={() => toggleGroup(label)}
                className="flex w-full items-center gap-1 px-2.5 py-1 text-micro uppercase text-text-tertiary tracking-widest hover:text-text-secondary transition-colors duration-150"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    collapsed[label] && "-rotate-90"
                  )}
                />
                {label}
              </button>
              {!collapsed[label] && (
                <div className="mt-0.5 space-y-0.5">
                  {dateChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={pathname === `/chat/${chat.id}`}
                      onDelete={(e) => handleDelete(e, chat.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <Link
          href="/deposit"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-150",
            pathname === "/deposit"
              ? "bg-elevated text-foreground"
              : "text-text-secondary hover:bg-elevated/60 hover:text-foreground"
          )}
        >
          <Star className="h-4 w-4" />
          Add credits
        </Link>
      </div>
    </div>
  );
}
