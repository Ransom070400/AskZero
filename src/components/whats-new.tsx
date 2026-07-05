"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Smartphone,
  Globe,
  Webhook,
  Store,
  Terminal,
  Download,
  X,
} from "lucide-react";

// Dismissible "What's new" announcement. Shows until EXPIRES (5 days after
// launch) OR until the user dismisses it (persisted in localStorage). Bump
// STORAGE_KEY + EXPIRES for the next announcement to reuse this component.
const STORAGE_KEY = "askzero-whatsnew-2026-07-05";
const EXPIRES = new Date("2026-07-10T23:59:59Z").getTime();

const ANDROID_APK_URL =
  "https://expo.dev/accounts/ransom070/projects/askzero/builds/8b47c0fa-a43c-47ec-8232-22e321f66946";

export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Date.now() > EXPIRES) return; // 5-day window has passed
    try {
      if (localStorage.getItem(STORAGE_KEY)) return; // already dismissed
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
      /* private mode — just close */
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
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="What's new"
            className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-border bg-elevated shadow-xl"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="press absolute right-4 top-4 z-10 text-text-tertiary transition-colors hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="overflow-y-auto p-6">
              <div className="mb-1 flex items-center gap-2 text-accent">
                <Sparkles className="h-4 w-4" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                  What&apos;s new
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Two fresh updates
              </h2>

              <div className="mt-5 space-y-3">
                <Item
                  icon={<Smartphone className="h-5 w-5" />}
                  title="AskZero is now on mobile"
                  body="The mobile app has shipped — chat, autonomous research, your balance, and deposits, all in your pocket."
                  action={{ label: "Download for Android (APK)", href: ANDROID_APK_URL }}
                />
                <Item
                  icon={<Globe className="h-5 w-5" />}
                  title="Pay in USD & APAC currencies"
                  body="Top up in US Dollars and 13 Asia-Pacific currencies (JPY, SGD, INR and more) — no longer Naira-only."
                />
              </div>

              {/* Coming soon */}
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Coming soon
                </p>
                <div className="space-y-2">
                  <Soon
                    icon={<Webhook className="h-4 w-4" />}
                    title="API Gateway"
                    body="Programmatic access to AskZero from your own apps."
                  />
                  <Soon
                    icon={<Store className="h-4 w-4" />}
                    title="On the App Store & Google Play"
                    body="One-tap installs — no sideloading required."
                  />
                  <Soon
                    icon={<Terminal className="h-4 w-4" />}
                    title="AskZero CLI"
                    body="Chat and automate straight from your terminal."
                  />
                </div>
              </div>

              <button
                onClick={dismiss}
                className="press mt-6 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Item({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-background/50 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
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
