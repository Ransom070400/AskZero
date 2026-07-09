"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Rocket,
  Gift,
  Users,
  Code2,
  BarChart3,
  Command,
  ShieldCheck,
  BookLock,
  Lock,
  Webhook,
  Store,
  Terminal,
  Download,
  ArrowRight,
  X,
} from "lucide-react";

// Two-step announcement: "What's new" shows first; closing it reveals "Coming
// soon"; closing that dismisses for good (persisted). BUMP STORAGE_KEY whenever
// the contents change so the refreshed cards reach everyone again.
const STORAGE_KEY = "askzero-whatsnew-2026-07-09-v7";
const EXPIRES = new Date("2026-08-15T23:59:59Z").getTime();

export function WhatsNew() {
  // null = hidden, 0 = What's new, 1 = Coming soon
  const [step, setStep] = useState<0 | 1 | null>(null);

  useEffect(() => {
    if (Date.now() > EXPIRES) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setStep(0), 500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    setStep(null);
  };

  // Closing card 1 advances to card 2; closing card 2 dismisses everything.
  const close = () => (step === 0 ? setStep(1) : dismiss());

  return (
    <AnimatePresence>
      {step !== null && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Dismiss"
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <Card key="new">
                <div className="relative overflow-hidden bg-gradient-to-br from-accent/25 via-accent/5 to-transparent px-6 pb-5 pt-6">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
                  <CloseX onClick={close} />
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

                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 pt-1">
                  <Item
                    icon={<Gift className="h-5 w-5" />}
                    title="Free credits to start"
                    isNew
                    body="New accounts begin with free credits — try AskZero before you pay a thing. No subscription; you only pay per question."
                  />
                  <Item
                    icon={<Users className="h-5 w-5" />}
                    title="Refer a friend — both earn"
                    isNew
                    body="Share your invite link from Settings. When a friend signs up, you both get free credits."
                  />
                  <Item
                    icon={<Code2 className="h-5 w-5" />}
                    title="Build with Code"
                    isNew
                    body="Describe an app or script and AskZero plans it, writes it, reviews its own work for bugs, then shows a live preview. Open “Code” in the sidebar."
                  />
                  <Item
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="Answers that are easy to scan"
                    isNew
                    body="Now with charts, tables, collapsible details, and callouts — not just walls of text."
                  />
                  <Item
                    icon={<Command className="h-5 w-5" />}
                    title="Faster to get around"
                    isNew
                    body="Press ⌘K to jump anywhere, use /research and /image in the composer, pin your important chats, and hit ? for shortcuts."
                  />
                  <Item
                    icon={<ShieldCheck className="h-5 w-5" />}
                    title="Verified answers"
                    body="Every answer comes with a tamper-proof receipt. Tap “Verified” on any reply to prove it wasn't changed."
                  />
                </div>

                <Footer>
                  <Dots active={0} />
                  <button
                    onClick={() => setStep(1)}
                    className="press inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
                  >
                    See what&apos;s coming
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Footer>
              </Card>
            ) : (
              <Card key="soon">
                <div className="px-6 pb-4 pt-6">
                  <CloseX onClick={dismiss} />
                  <Eyebrow icon={<Rocket className="h-3.5 w-3.5" />} tone="muted">
                    Coming soon
                  </Eyebrow>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    On the roadmap
                  </h2>
                  <p className="mt-1 text-[13px] text-text-secondary">
                    What we&apos;re building next.
                  </p>
                </div>

                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pt-1">
                  <Soon
                    icon={<BookLock className="h-4 w-4" />}
                    title="Private journaling"
                    body="An encrypted, private journal with AI reflections — readable only by you."
                  />
                  <Soon
                    icon={<Lock className="h-4 w-4" />}
                    title="Sealed predictions"
                    body="Lock in a prediction now, reveal it later — with proof you made it before the outcome."
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

                <Footer>
                  <Dots active={1} />
                  <button
                    onClick={dismiss}
                    className="press inline-flex h-10 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
                  >
                    Got it
                  </button>
                </Footer>
              </Card>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl"
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      {children}
    </motion.div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex shrink-0 items-center justify-between border-t border-border/60 px-6 py-4">
      {children}
    </div>
  );
}

function Dots({ active }: { active: 0 | 1 }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1].map((i) => (
        <span
          key={i}
          className={
            i === active
              ? "h-1.5 w-4 rounded-full bg-accent transition-all"
              : "h-1.5 w-1.5 rounded-full bg-border transition-all"
          }
        />
      ))}
    </div>
  );
}

function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close"
      className="press absolute right-4 top-4 z-10 text-text-tertiary transition-colors hover:text-foreground"
    >
      <X className="h-5 w-5" />
    </button>
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
