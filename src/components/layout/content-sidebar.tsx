"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Trash2,
  ChevronDown,
  Sparkles,
  BookLock,
  Lock,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { Logo } from "@/components/ui/logo";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
}

interface SearchHit {
  message_id: string;
  chat_id: string;
  chat_title: string;
  role: "user" | "assistant" | "system";
  snippet: string;
  created_at: string;
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const m = Math.floor((Date.now() - then) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

function ChatRow({
  chat,
  isActive,
  onDelete,
  onRename,
  onTogglePin,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const committedRef = useRef(false);

  const startRename = () => {
    committedRef.current = false;
    setDraft(chat.title);
    setRenaming(true);
  };
  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const t = draft.trim();
    setRenaming(false);
    if (t && t !== chat.title) onRename(t);
  };
  const cancel = () => {
    committedRef.current = true;
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center rounded-xl bg-elevated pl-3 pr-1.5 py-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          className="w-full border-b border-accent bg-transparent text-[13px] text-foreground outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/row relative flex items-center justify-between rounded-xl pl-3 pr-1.5 py-1.5 text-[13px] transition-colors duration-fast ease-out",
        isActive
          ? "bg-accent-muted text-foreground"
          : "text-text-secondary hover:bg-elevated hover:text-foreground"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-accent" />
      )}
      <Link
        href={`/chat/${chat.id}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 truncate",
          isActive ? "font-semibold" : "font-medium"
        )}
      >
        {chat.pinned && <Pin className="h-3 w-3 shrink-0 text-text-tertiary" />}
        <span className="truncate">{chat.title}</span>
      </Link>

      {confirmDelete ? (
        <span className="flex shrink-0 items-center gap-1 pl-1">
          <button
            onClick={onDelete}
            className="press rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-error hover:bg-error/10"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="press rounded-md px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary hover:bg-background"
          >
            Cancel
          </button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center pl-1">
          <span className="pr-0.5 text-[11px] tabular-nums text-text-tertiary/70 group-hover/row:hidden">
            {relativeTime(chat.updated_at)}
          </span>
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Chat options"
              className="press hidden shrink-0 items-center justify-center rounded-md p-1 text-text-tertiary transition-colors duration-fast hover:bg-background hover:text-foreground group-hover/row:flex data-[state=open]:flex"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={startRename}>
              <Pencil className="mr-2 h-3.5 w-3.5 text-text-tertiary" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePin}>
              {chat.pinned ? (
                <>
                  <PinOff className="mr-2 h-3.5 w-3.5 text-text-tertiary" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-3.5 w-3.5 text-text-tertiary" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-error focus:text-error"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </div>
  );
}

function FooterLink({
  href,
  icon,
  label,
  active,
  soon,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  soon?: boolean;
}) {
  const inner = (
    <>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-accent" />
      )}
      <span className={cn(active ? "text-accent" : "text-text-tertiary")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {soon && (
        <span className="rounded-full border border-border/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-text-tertiary">
          Soon
        </span>
      )}
    </>
  );

  if (soon) {
    return (
      <div
        title="Coming soon"
        className="relative flex cursor-default items-center gap-2.5 rounded-xl pl-3 pr-3 py-2 text-[13px] font-medium text-text-tertiary/80"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href!}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl pl-3 pr-3 py-2 text-[13px] font-medium transition-colors duration-fast ease-out",
        active
          ? "bg-accent-muted text-foreground"
          : "text-text-secondary hover:bg-elevated hover:text-foreground"
      )}
    >
      {inner}
    </Link>
  );
}

// ts_headline produces <mark>…</mark> spans — render them as styled
// highlights without using dangerouslySetInnerHTML by walking the string.
function HighlightedSnippet({ html }: { html: string }) {
  const parts = html.split(/(<mark>[\s\S]*?<\/mark>)/g);
  return (
    <span className="text-text-secondary">
      {parts.map((p, i) => {
        const m = p.match(/^<mark>([\s\S]*?)<\/mark>$/);
        if (m) {
          return (
            <mark
              key={i}
              className="rounded-sm bg-accent-muted px-0.5 text-foreground"
            >
              {m[1]}
            </mark>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function MessageHits({
  hits,
  loading,
  chatId,
}: {
  hits: SearchHit[];
  loading: boolean;
  chatId: string;
}) {
  if (loading && hits.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        Searching…
      </p>
    );
  }
  if (hits.length === 0) return null;
  return (
    <div className="border-b border-border/70 pb-3 mb-2">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        Messages · {hits.length}
      </p>
      <div className="space-y-px">
        {hits.map((h) => (
          <Link
            key={h.message_id}
            href={`/chat/${h.chat_id}#msg-${h.message_id}`}
            className={cn(
              "block rounded-xl px-3 py-1.5 text-[12px] transition-colors duration-fast ease-out hover:bg-elevated",
              chatId === `/chat/${h.chat_id}`
                ? "bg-accent-muted/60"
                : ""
            )}
          >
            <div className="truncate text-[12px] font-semibold text-foreground">
              {h.chat_title || "Untitled chat"}
            </div>
            <div className="line-clamp-2 text-[11.5px] leading-snug">
              <HighlightedSnippet html={h.snippet} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ContentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadedChats, setLoadedChats] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // silently fail
    } finally {
      setLoadedChats(true);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, pathname]);

  // Debounced full-text search over message content. Title matching stays
  // local (instant) while content matching hits the server.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setHits(data.results || []);
        }
      } catch {
        // ignore aborts and transient errors
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  const handleDelete = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (pathname === `/chat/${chatId}`) router.push("/chat");
      toast.success("Chat deleted");
    } else {
      toast.error("Couldn't delete the chat");
    }
  };

  const handleRename = async (chatId: string, title: string) => {
    const prev = chats;
    setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, title } : c)));
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      setChats(prev); // revert
      toast.error("Couldn't rename the chat");
    }
  };

  const handleTogglePin = async (chatId: string, pinned: boolean) => {
    const prev = chats;
    setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, pinned } : c)));
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    if (res.ok) {
      toast.success(pinned ? "Pinned" : "Unpinned");
    } else {
      setChats(prev); // revert
      toast.error("Couldn't update the chat");
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
  const pinnedChats = filtered.filter((c) => c.pinned);
  const grouped = groupChatsByDate(filtered.filter((c) => !c.pinned));

  return (
    <div className="hidden md:flex h-full w-[268px] flex-col border-r border-border/70 bg-surface">
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
            className="h-9 w-full rounded-xl bg-elevated/70 pl-8 pr-3 text-[13px] font-medium text-foreground placeholder:font-normal placeholder:text-text-tertiary outline-none border border-transparent transition-[border-color,background-color,box-shadow] duration-fast ease-out hover:bg-elevated focus:bg-background focus:border-accent/50 focus:shadow-ring"
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
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-surface to-transparent" />
        <div className="h-full overflow-y-auto px-2">
        {query.trim().length >= 2 && (
          <MessageHits hits={hits} loading={searching} chatId={pathname} />
        )}
        {!loadedChats && chats.length === 0 ? (
          <div className="space-y-1.5 px-1 py-2" aria-hidden>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-xl bg-elevated"
                style={{ width: `${92 - (i % 3) * 14}%` }}
              />
            ))}
          </div>
        ) : (
        <div className="space-y-5 py-1">
          {pinnedChats.length > 0 && (
            <div>
              <div className="flex w-full items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
                <span className="ml-auto font-medium normal-case tracking-normal text-text-tertiary/70">
                  {pinnedChats.length}
                </span>
              </div>
              <div className="mt-1 space-y-px">
                {pinnedChats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    isActive={pathname === `/chat/${chat.id}`}
                    onDelete={() => handleDelete(chat.id)}
                    onRename={(title) => handleRename(chat.id, title)}
                    onTogglePin={() => handleTogglePin(chat.id, !chat.pinned)}
                  />
                ))}
              </div>
            </div>
          )}
          {Object.entries(grouped).map(([label, dateChats]) => {
            const isCollapsed = collapsed[label];
            return (
              <div key={label}>
                <button
                  onClick={() => toggleGroup(label)}
                  className="flex w-full items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary hover:text-text-secondary transition-colors duration-fast"
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
                        onDelete={() => handleDelete(chat.id)}
                        onRename={(title) => handleRename(chat.id, title)}
                        onTogglePin={() => handleTogglePin(chat.id, !chat.pinned)}
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
        )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-surface to-transparent" />
      </div>

      {/* Footer */}
      <div className="border-t border-border/70 p-2 space-y-px">
        <FooterLink
          icon={<BookLock className="h-4 w-4" />}
          label="Private journaling"
          soon
        />
        <FooterLink
          icon={<Lock className="h-4 w-4" />}
          label="Sealed predictions"
          soon
        />
        <FooterLink
          href="/research"
          icon={<Sparkles className="h-4 w-4" />}
          active={pathname === "/research"}
          label="Research"
        />
      </div>
    </div>
  );
}
