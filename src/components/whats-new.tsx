"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Rocket,
  EyeOff,
  ShieldCheck,
  Brain,
  Smartphone,
  Globe,
  BookLock,
  Lock,
  Webhook,
  Store,
  Terminal,
  Download,
  X,
} from "lucide-react";

// Dismissible "What's new" announcement. Shows until EXPIRES OR until dismissed
// (persisted in localStorage). BUMP STORAGE_KEY whenever the contents change so
// the refreshed cards are shown to everyone again — that's how updates reach users.
const STORAGE_KEY = "askzero-whatsnew-2026-07-06-v3";
const EXPIRES = new Date("2026-07-16T23:59:59Z").getTime();

const ANDROID_APK_URL =
  "https://expo.dev/accounts/ransom070/projects/askzero/builds/8b47c0fa-a43c-47ec-8232-22e321f66946";

export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Date.now() > EXPIRES) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Dismiss"
            onClick={dismiss}
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Two stacked cards */}
          <motion.div
            className="relative flex max-h-[88dvh] w-full max-w-md flex-col gap-3 overflow-y-auto"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            {/* ── Card 1: What's new ── */}
            <div
              role="dialog"
              aria-label="What's new"
              className="overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-accent/25 via-accent/5 to-transparent px-6 pb-5 pt-6">
                <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
                <button
                  onClick={dismiss}
                  aria-label="Close"
                  className="press absolute right-4 top-4 text-text-tertiary transition-colors hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
                <Eyebrow icon={<Sparkles className="h-3.5 w-3.5" />} tone="accent">
                  What&apos;s new
                </Eyebrow>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Fresh in AskZero
                </h2>
                <p className="mt-1 text-[13px] text-text-secondary">
                  The latest, just shipped.
                </p>
              </div>

              <div className="space-y-2.5 px-6 pb-6 pt-1">
                <Item
                  icon={<EyeOff className="h-5 w-5" />}
                  title="Incognito mode"
                  isNew
                  body="Chat privately — nothing is saved and nothing is remembered. Open it from the mask icon in the top bar."
                />
                <Item
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Verified receipts"
                  isNew
                  body="Every answer is provable on 0G. Tap “Verify on 0G” on any reply to re-derive the proof and confirm it on-chain."
                />
                <Item
                  icon={<Brain className="h-5 w-5" />}
                  title="Memory layer on 0G Storage"
                  isNew
                  body="AskZero remembers durable facts across chats — archived to 0G Storage, so your memory is content-addressed and yours."
                />
                <Item
                  icon={<Smartphone className="h-5 w-5" />}
                  title="AskZero on mobile"
                  body="The iOS & Android app has shipped — chat, research, balance, and deposits in your pocket."
                  action={{ label: "Download for Android (APK)", href: ANDROID_APK_URL }}
                />
                <Item
                  icon={<Globe className="h-5 w-5" />}
                  title="Pay in USD & APAC"
                  body="Top up in US Dollars and 13 Asia-Pacific currencies — no longer Naira-only."
                />
              </div>
            </div>

            {/* ── Card 2: Coming soon ── */}
            <div
              aria-label="Coming soon"
              className="overflow-hidden rounded-2xl border border-border bg-elevated shadow-xl"
            >
              <div className="px-6 pb-4 pt-5">
                <Eyebrow icon={<Rocket className="h-3.5 w-3.5" />} tone="muted">
                  Coming soon
                </Eyebrow>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  On the roadmap
                </h3>
              </div>
              <div className="space-y-1 px-5 pb-5">
                <Soon
                  icon={<BookLock className="h-4 w-4" />}
                  title="Private journaling"
                  body="An encrypted, private journal with AI reflections — kept on 0G, readable only by you."
                />
                <Soon
                  icon={<Lock className="h-4 w-4" />}
                  title="Sealed predictions"
                  body="Commit a prediction on-chain now, reveal it later — provably made before the outcome."
                />
                <Soon
                  icon={<Webhook className="h-4 w-4" />}
                  title="API Gateway"
                  body="Programmatic access to AskZero from your own apps."
                />
                <Soon
                  icon={<Store className="h-4 w-4" />}
                  title="On the App Store & Google Play"
                  body="One-tap installs — no sideloading."
                />
                <Soon
                  icon={<Terminal className="h-4 w-4" />}
                  title="AskZero CLI"
                  body="Chat and automate from your terminal."
                />
              </div>
              <div className="px-5 pb-5">
                <button
                  onClick={dismiss}
                  className="press h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Eyebrow({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone: "accent" | "muted";
}) {
  return (
    <div
      className={
        tone === "accent"
          ? "mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent"
          : "mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary"
      }
    >
      {icon}
      {children}
    </div>
  );
}

function Item({
  icon,
  title,
  body,
  isNew,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  isNew?: boolean;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-foreground">{title}</p>
          {isNew && (
            <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
              New
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-text-tertiary">{body}</p>
        {action && (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:bg-accent/20"
          >
            <Download className="h-3.5 w-3.5" />
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}

function Soon({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-1 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-text-tertiary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-semibold text-foreground/80">{title}</p>
          <span className="rounded-full border border-border/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-text-tertiary">
            Soon
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{body}</p>
      </div>
    </div>
  );
}
