"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  EyeOff,
  Sparkles,
  CreditCard,
  Settings,
  MessageSquare,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatItem {
  id: string;
  title: string | null;
}

// ⌘K / Ctrl+K quick launcher: jump to a chat, start one, or navigate.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const supabase = createClient();
    supabase
      .from("chats")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setChats(data as ChatItem[]);
      });
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  const actions = useMemo(
    () => [
      { id: "new", label: "New chat", icon: Plus, run: () => router.push("/chat") },
      { id: "incognito", label: "New incognito chat", icon: EyeOff, run: () => router.push("/chat/incognito") },
      { id: "research", label: "Research", icon: Sparkles, run: () => router.push("/research") },
      { id: "deposit", label: "Deposit / balance", icon: CreditCard, run: () => router.push("/deposit") },
      { id: "settings", label: "Settings", icon: Settings, run: () => router.push("/settings") },
    ],
    [router]
  );

  const q = query.trim().toLowerCase();
  const filteredActions = q
    ? actions.filter((a) => a.label.toLowerCase().includes(q))
    : actions;
  const filteredChats = (
    q ? chats.filter((c) => (c.title || "").toLowerCase().includes(q)) : chats
  ).slice(0, q ? 8 : 6);

  // Flat list for keyboard navigation (actions first, then chats).
  const items = useMemo(
    () => [
      ...filteredActions.map((a) => ({ kind: "action" as const, key: a.id, run: a.run })),
      ...filteredChats.map((c) => ({
        kind: "chat" as const,
        key: c.id,
        run: () => router.push(`/chat/${c.id}`),
      })),
    ],
    [filteredActions, filteredChats, router]
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  const close = () => setOpen(false);
  const select = (i: number) => {
    const it = items[i];
    if (it) {
      it.run();
      close();
    }
  };

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(active);
    } else if (e.key === "Escape") {
      close();
    }
  };

  const actionCount = filteredActions.length;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[14vh]">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border/70 px-4">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search chats or run a command…"
            className="h-12 w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-text-tertiary"
          />
          <kbd className="shrink-0 rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-text-tertiary">
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-text-tertiary">
              No matches
            </p>
          )}

          {filteredActions.length > 0 && (
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Actions
            </p>
          )}
          {filteredActions.map((a, i) => {
            const Icon = a.icon;
            return (
              <Row
                key={a.id}
                active={active === i}
                onHover={() => setActive(i)}
                onClick={() => select(i)}
                icon={<Icon className="h-4 w-4" />}
                label={a.label}
              />
            );
          })}

          {filteredChats.length > 0 && (
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Chats
            </p>
          )}
          {filteredChats.map((c, j) => {
            const idx = actionCount + j;
            return (
              <Row
                key={c.id}
                active={active === idx}
                onHover={() => setActive(idx)}
                onClick={() => select(idx)}
                icon={<MessageSquare className="h-4 w-4" />}
                label={c.title || "Untitled chat"}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  active,
  onHover,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
        active ? "bg-accent-muted text-foreground" : "text-text-secondary"
      )}
    >
      <span className={active ? "text-accent" : "text-text-tertiary"}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
