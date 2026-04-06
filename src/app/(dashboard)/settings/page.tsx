"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency";

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

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">Display currency</p>
            <p className="text-sm text-text-tertiary">How balances are shown</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
            {(["NGN", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setDisplayCurrency(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  displayCurrency === c
                    ? "bg-elevated text-foreground shadow-sm"
                    : "text-text-tertiary hover:text-foreground"
                }`}
              >
                {c === "NGN" ? "₦ Naira" : "$ USD"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">API keys</p>
            <p className="text-sm text-text-tertiary">Programmatic access to AskZero</p>
          </div>
          <span className="text-xs text-text-tertiary bg-surface px-2 py-1 rounded-md">Coming soon</span>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-5">
        <h2 className="text-micro uppercase text-text-tertiary tracking-widest">Account</h2>

        <div className="flex items-center justify-between py-3">
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
      </section>
    </div>
  );
}
