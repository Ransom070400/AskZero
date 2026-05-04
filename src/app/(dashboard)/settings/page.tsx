"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, Copy, Check, Trash2, ChevronDown, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrency, type DisplayCurrency } from "@/lib/currency";
import { APAC_CURRENCIES, APAC_CODES, isApacCurrency } from "@/lib/pricing-apac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-muted text-[16px] font-bold text-accent">
          {initials}
        </div>
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
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
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
    <div className="inline-flex items-center rounded-lg bg-surface p-0.5">
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
