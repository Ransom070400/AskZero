"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, Copy, Check, Trash2, ChevronDown, AlertTriangle, Sparkles, KeyRound, Boxes, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrency, type DisplayCurrency } from "@/lib/currency";
import { APAC_CURRENCIES, APAC_CODES, isApacCurrency } from "@/lib/pricing-apac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReferralCard } from "@/components/referral-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Profile {
  display_name: string;
  avatar_url: string | null;
  credits_balance: number;
}

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const { currency: displayCurrency, setCurrency: setDisplayCurrency, formatBalance } = useCurrency();

  useEffect(() => setMounted(true), []);

  const fetchProfile = useCallback(async () => {
    const { data: { user } }: { data: { user: User | null } } = await supabase.auth.getUser();
    if (!user) return;
    setUser(user);

    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, credits_balance")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete account");
      }
    } catch {
      alert("Failed to delete account");
    }
    setDeleting(false);
  };

  const copyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const initials = profile?.display_name
    ? profile.display_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "AZ";

  // Prefer a stored avatar, then the OAuth (Google) photo from user metadata,
  // then fall back to initials.
  const avatarUrl =
    profile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;

  return (
    <div className="mx-auto w-full max-w-form px-5 md:px-6 py-8 md:py-12 space-y-9">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.025em]">
          Settings
        </h1>
        <p className="text-[15px] text-text-secondary">
          Manage your profile, appearance, and account.
        </p>
      </div>

      {/* Profile hero */}
      <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-elevated/60 p-5">
        {avatarUrl && !avatarError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={profile?.display_name || "Profile"}
            referrerPolicy="no-referrer"
            onError={() => setAvatarError(true)}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-muted text-[16px] font-bold text-accent">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-foreground">
            {profile?.display_name || user?.email?.split("@")[0] || "—"}
          </p>
          <p className="truncate text-[13px] text-text-secondary">
            {user?.email || "—"}
          </p>
        </div>
      </div>

      {/* Profile section */}
      <Section title="Profile">
        <Row
          title="Display name"
          subtitle="Visible in your chats"
        >
          <div className="flex items-center gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-9 w-44 text-right"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || displayName === profile?.display_name}
            >
              {saved ? "Saved" : saving ? "…" : "Save"}
            </Button>
          </div>
        </Row>
        <Row title="Email" subtitle="Used for sign in">
          <p className="text-[13px] text-text-secondary truncate">
            {user?.email || "—"}
          </p>
        </Row>
        <Row title="Account ID" subtitle="Your unique identifier">
          <button
            onClick={copyId}
            className="press flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-text-secondary hover:bg-surface hover:text-foreground transition-colors duration-fast"
          >
            <span className="font-mono">{user?.id?.slice(0, 8)}…</span>
            {copiedId ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Row>
        <Row title="Balance" subtitle="Available credits">
          <p className="text-[13px] font-semibold text-foreground tabular-nums">
            {profile
              ? `${formatBalance(profile.credits_balance)} · ${profile.credits_balance.toLocaleString()}c`
              : "—"}
          </p>
        </Row>
      </Section>

      {/* Premium / Pro upsell — Plan B preview, gated until launch */}
      <PremiumCard />

      {/* Appearance section */}
      <Section title="Appearance">
        <Row title="Theme" subtitle="Light, dark, or follow system">
          {mounted && (
            <Segmented
              value={theme || "system"}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
              onChange={(v) => setTheme(v)}
            />
          )}
        </Row>
      </Section>

      {/* Preferences section */}
      <Section title="Preferences">
        <Row
          title="Display currency"
          subtitle="How balances are shown"
        >
          <Segmented
            value={
              isApacCurrency(displayCurrency) ? "APAC" : displayCurrency
            }
            options={[
              { value: "NGN", label: "₦" },
              { value: "USD", label: "$" },
              { value: "APAC", label: "APAC" },
            ]}
            onChange={(v) => {
              if (v === "APAC") {
                if (!isApacCurrency(displayCurrency)) setDisplayCurrency("JPY");
              } else {
                setDisplayCurrency(v as DisplayCurrency);
              }
            }}
          />
        </Row>
        {isApacCurrency(displayCurrency) && (
          <Row title="APAC currency" subtitle="Test mode">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="press group flex items-center gap-2 rounded-lg border border-border/70 bg-elevated px-3 py-1.5 text-[13px] font-medium text-foreground transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong">
                  <span className="text-text-tertiary">
                    {APAC_CURRENCIES[displayCurrency].symbol}
                  </span>
                  <span>{APAC_CURRENCIES[displayCurrency].code}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-text-tertiary group-hover:text-foreground transition-colors duration-fast" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto overscroll-contain">
                {APAC_CODES.map((code) => {
                  const m = APAC_CURRENCIES[code];
                  return (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => setDisplayCurrency(code)}
                    >
                      <span className="w-7 text-text-tertiary">{m.symbol}</span>
                      <span className="font-semibold">{m.code}</span>
                      <span className="ml-2 truncate text-text-secondary">
                        {m.label}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
        )}
        <Row
          title="API keys"
          subtitle="Programmatic access to AskZero"
        >
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Soon
          </span>
        </Row>
      </Section>

      {/* Refer & earn — invite friends, both get free credits */}
      <ReferralCard />

      {/* Memory — what the assistant remembers across chats */}
      <MemorySection />

      {/* Security & Privacy */}
      <Section title="Security & Privacy">
        <Row
          title="Security policy"
          subtitle="How we protect your data & report a vulnerability"
        >
          <Link
            href="/security"
            className="press inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-elevated px-3 py-1.5 text-[13px] font-medium text-foreground transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong"
          >
            View
            <ArrowUpRight className="h-3.5 w-3.5 text-text-tertiary" />
          </Link>
        </Row>
      </Section>

      {/* Account section */}
      <Section title="Account">
        <Row title="Sign out" subtitle="Sign out on this device">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </Row>
      </Section>

      {/* Danger zone — separate, never grouped with normal settings */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-error/80">
          Danger zone
        </h2>
        <div className="overflow-hidden rounded-2xl border border-error/30 bg-error/5">
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">
                Delete account
              </p>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Permanently delete your account, all chats, and transactions.
                This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm((s) => !s)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>

          {showDeleteConfirm && (
            <div className="border-t border-error/30 bg-error/5 p-5 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <p className="text-[13px] font-medium leading-relaxed text-error">
                  This action is irreversible. All your chats, messages,
                  transactions, and uploaded files will be permanently deleted.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Type <span className="font-mono">DELETE</span> to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="border-error/40 focus:border-error focus:shadow-[0_0_0_3px_hsl(var(--error)/0.18)]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleting}
                >
                  {deleting ? "Deleting…" : "Permanently delete my account"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PremiumCard() {
  const perks = [
    {
      icon: KeyRound,
      title: "Your own inference API",
      desc: "Prompt AskZero programmatically with a personal API key.",
    },
    {
      icon: Boxes,
      title: "Dedicated 0G compute",
      desc: "Run inference from your own on-chain 0G ledger at wholesale rates.",
    },
    {
      icon: ShieldCheck,
      title: "Verifiable receipts",
      desc: "Every inference signed by and paid from your own identity.",
    },
  ];

  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        Plan
      </h2>
      <div className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-b from-accent-muted/40 to-elevated/40 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-foreground">
                AskZero Pro
              </p>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Programmatic access on your own dedicated compute.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Coming soon
          </span>
        </div>

        <div className="space-y-2.5">
          {perks.map((perk) => {
            const Icon = perk.icon;
            return (
              <div key={perk.title} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {perk.title}
                  </p>
                  <p className="text-[12px] text-text-tertiary leading-relaxed">
                    {perk.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <Button size="sm" className="w-full" disabled>
          Upgrade to Premium · Coming soon
        </Button>
      </div>
    </section>
  );
}

interface Memory {
  id: string;
  content: string;
  created_at: string;
  og_root_hash: string | null;
}

// Warmer, glanceable relative time ("3d ago") with the full timestamp on hover.
function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}

function MemorySkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-[85%] animate-pulse rounded bg-border/60" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-border/40" />
          </div>
          <div className="h-6 w-6 shrink-0 animate-pulse rounded-lg bg-border/40" />
        </div>
      ))}
    </>
  );
}

function MemorySection() {
  const supabase = createClient();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, content, created_at, og_root_hash")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (!error && data) setMemories(data as Memory[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleDelete = async (id: string) => {
    // Optimistic — RLS lets a user delete only their own rows.
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("memories").delete().eq("id", id);
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-muted text-accent">
            <Sparkles className="h-3 w-3" />
          </span>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Memory
          </h2>
        </div>
        {!loading && memories.length > 0 && (
          <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-tertiary tabular-nums">
            {memories.length} {memories.length === 1 ? "memory" : "memories"}
          </span>
        )}
      </div>
      <p className="px-1 text-[12px] text-text-secondary leading-relaxed">
        What AskZero remembers about you across chats. Anchored on 0G — delete
        anything you don&apos;t want kept.
      </p>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-elevated/40 divide-y divide-border/50">
        {loading ? (
          <MemorySkeleton />
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-5 py-8 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted/60 text-accent">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="max-w-[280px] text-[13px] text-text-tertiary leading-relaxed">
              Nothing remembered yet. As you chat, AskZero notes durable facts —
              preferences, projects, recurring goals — and they&apos;ll show up here.
            </p>
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="group/mem flex items-start justify-between gap-3 px-5 py-3.5 transition-colors duration-fast hover:bg-surface/40"
            >
              <div className="min-w-0 space-y-1.5">
                <p className="text-[13px] text-foreground leading-relaxed">
                  {m.content}
                </p>
                <div className="flex items-center gap-2">
                  {m.og_root_hash && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success"
                      title={`Anchored on 0G Storage · ${m.og_root_hash.slice(0, 10)}…`}
                    >
                      <ShieldCheck className="h-2.5 w-2.5" />
                      On 0G
                    </span>
                  )}
                  <span
                    className="text-[10px] text-text-tertiary tabular-nums"
                    title={new Date(m.created_at).toLocaleString()}
                  >
                    {timeAgo(m.created_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                aria-label="Forget this memory"
                className="press shrink-0 rounded-lg p-1.5 text-text-tertiary opacity-100 transition-[color,background-color,opacity] duration-fast hover:bg-surface hover:text-error md:opacity-0 md:group-hover/mem:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-elevated/40 divide-y divide-border/50">
        {children}
      </div>
    </section>
  );
}

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="text-[12px] text-text-tertiary leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-xl bg-surface p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "press flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-[background-color,color,box-shadow] duration-fast ease-out",
              active
                ? "bg-elevated text-foreground shadow-sm"
                : "text-text-tertiary hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
