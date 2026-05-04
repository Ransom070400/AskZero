"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Trash2,
  ChevronDown,
  CreditCard,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

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

function ChatRow({
  chat,
  isActive,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={`/chat/${chat.id}`}
      className={cn(
        "group/row relative flex items-center justify-between rounded-lg pl-3 pr-1.5 py-1.5 text-[13px] transition-colors duration-fast ease-out",
        isActive
          ? "bg-accent-muted text-foreground"
          : "text-text-secondary hover:bg-elevated hover:text-foreground"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-accent" />
      )}
      <span
        className={cn(
          "truncate",
          isActive ? "font-semibold" : "font-medium"
        )}
      >
        {chat.title}
      </span>
      <button
        onClick={onDelete}
        aria-label="Delete chat"
        className="press hidden shrink-0 rounded-md p-1 text-text-tertiary transition-colors duration-fast hover:bg-background hover:text-error group-hover/row:flex items-center justify-center"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Link>
  );
}

function FooterLink({
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

export function ContentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

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

  const filtered = query
    ? chats.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      )
    : chats;
  const grouped = groupChatsByDate(filtered);

  return (
    <div className="hidden md:flex h-full w-[268px] flex-col border-r border-border/60 bg-surface">
      {/* Brand */}
      <div className="flex items-center px-5 h-14">
        <Logo size={22} />
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-lg bg-elevated/70 pl-8 pr-3 text-[13px] font-medium text-foreground placeholder:font-normal placeholder:text-text-tertiary outline-none border border-transparent transition-[border-color,background-color,box-shadow] duration-fast ease-out hover:bg-elevated focus:bg-background focus:border-accent/50 focus:shadow-ring"
          />
        </label>
      </div>

      {/* New chat */}
      <div className="px-3 pb-3">
        <button
          onClick={() => router.push("/chat")}
          className="press group flex w-full items-center justify-between rounded-xl border border-border/70 bg-elevated px-3 py-2 text-[13px] font-semibold text-foreground shadow-sm transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-text-tertiary group-hover:text-accent transition-colors duration-fast" />
            New chat
          </span>
          <kbd className="text-[10px] font-medium tracking-wider text-text-tertiary">⌘N</kbd>
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-5 py-1">
          {Object.entries(grouped).map(([label, dateChats]) => {
            const isCollapsed = collapsed[label];
            return (
              <div key={label}>
                <button
                  onClick={() => toggleGroup(label)}
                  className="flex w-full items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary hover:text-text-secondary transition-colors duration-fast"
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-base ease-out",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                  <span>{label}</span>
                  <span className="ml-auto font-medium normal-case tracking-normal text-text-tertiary/70">
                    {dateChats.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="mt-1 space-y-px">
                    {dateChats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        isActive={pathname === `/chat/${chat.id}`}
                        onDelete={(e) => handleDelete(e, chat.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-text-tertiary">
              {query ? "No matches" : "No chats yet"}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 p-2 space-y-px">
        <FooterLink
          href="/deposit"
          icon={<CreditCard className="h-4 w-4" />}
          active={pathname === "/deposit"}
          label="Deposit"
        />
        <FooterLink
          href="/settings"
          icon={<Settings className="h-4 w-4" />}
          active={pathname === "/settings"}
          label="Settings"
        />
      </div>
    </div>
  );
}
