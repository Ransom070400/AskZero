"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, Copy, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrency, type DisplayCurrency } from "@/lib/currency";
import { APAC_CURRENCIES, APAC_CODES, isApacCurrency } from "@/lib/pricing-apac";

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
    <div className="mx-auto max-w-form space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile */}
      <section className="space-y-5">
        <h2 className="text-micro uppercase text-text-tertiary tracking-widest">Profile</h2>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-lg font-semibold text-text-secondary">
            {initials}
          </div>
          <div>
            <p className="font-medium">{profile?.display_name || "—"}</p>
            <p className="text-sm text-text-secondary">{user?.email || "—"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Display name</p>
              <p className="text-sm text-text-tertiary">Visible in your chats</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-48 rounded-lg border border-border-strong bg-elevated px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-accent-muted text-right"
              />
              <button
                onClick={handleSave}
                disabled={saving || displayName === profile?.display_name}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40"
              >
                {saved ? "Saved" : saving ? "..." : "Save"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-text-tertiary">Used for sign in</p>
            </div>
            <p className="text-sm text-text-secondary">{user?.email || "—"}</p>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Account ID</p>
              <p className="text-sm text-text-tertiary">Your unique identifier</p>
            </div>
            <button
              onClick={copyId}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground transition-colors duration-150"
            >
              <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
              {copiedId ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Balance</p>
              <p className="text-sm text-text-tertiary">Available credits</p>
            </div>
            <p className="text-sm font-medium">
              {profile ? `${formatBalance(profile.credits_balance)} (${profile.credits_balance.toLocaleString()} credits)` : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-5">
        <h2 className="text-micro uppercase text-text-tertiary tracking-widest">Appearance</h2>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-sm text-text-tertiary">Choose your preferred appearance</p>
          </div>
          {mounted && (
            <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
              {([
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    theme === value
                      ? "bg-elevated text-foreground shadow-sm"
                      : "text-text-tertiary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-5">
        <h2 className="text-micro uppercase text-text-tertiary tracking-widest">Preferences</h2>

        <div className="py-3 border-b border-border space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Display currency</p>
              <p className="text-sm text-text-tertiary">How balances are shown</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
              {(["NGN", "USD", "APAC"] as const).map((c) => {
                const active =
                  c === "APAC"
                    ? isApacCurrency(displayCurrency)
                    : displayCurrency === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      if (c === "APAC") {
                        if (!isApacCurrency(displayCurrency)) setDisplayCurrency("JPY");
                      } else {
                        setDisplayCurrency(c);
                      }
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      active
                        ? "bg-elevated text-foreground shadow-sm"
                        : "text-text-tertiary hover:text-foreground"
                    }`}
                  >
                    {c === "NGN" ? "₦ Naira" : c === "USD" ? "$ USD" : "APAC"}
                  </button>
                );
              })}
            </div>
          </div>
          {isApacCurrency(displayCurrency) && (
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {APAC_CODES.map((code) => {
                const m = APAC_CURRENCIES[code];
                return (
                  <option key={code} value={code}>
                    {m.symbol} {m.code} — {m.label} ({m.country})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">API keys</p>
            <p className="text-sm text-text-tertiary">Programmatic access to AskZero</p>
          </div>
          <span className="text-xs text-text-tertiary bg-surface px-2 py-1 rounded-md">Coming soon</span>
        </div>
      </section>

      {/* Account */}
      <section className="space-y-5">
        <h2 className="text-micro uppercase text-text-tertiary tracking-widest">Account</h2>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-sm text-text-tertiary">Sign out of your account on this device</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-all duration-200 hover:bg-surface hover:text-foreground active:scale-[0.98]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        <div className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-500">Delete account</p>
              <p className="text-sm text-text-tertiary">Permanently delete your account and all data</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-500 transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <p className="text-sm text-red-500 font-medium">
                This action is irreversible. All your chats, messages, transactions, and uploaded files will be permanently deleted.
              </p>
              <div>
                <label className="text-xs text-text-tertiary block mb-1.5">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-red-500/30 bg-elevated px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleting}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-red-600 disabled:opacity-40 active:scale-[0.98]"
                >
                  {deleting ? "Deleting..." : "Permanently delete my account"}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-all duration-200 hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
