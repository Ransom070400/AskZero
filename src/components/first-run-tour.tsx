"use client";

import { useEffect, useState } from "react";
import { EyeOff, ShieldCheck, Cpu, CreditCard, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: EyeOff,
    title: "Private chats",
    body: "Start an incognito chat that's never saved or remembered — private by design. Toggle it from the top bar or ⌘K.",
  },
  {
    icon: ShieldCheck,
    title: "Answers you can trust",
    body: "Every reply gets a tamper-proof receipt — a fingerprint that proves the answer wasn't changed after the fact. Tap “Verified” on any answer to see it.",
  },
  {
    icon: Cpu,
    title: "Pick your model",
    body: "Switch anytime — a cheap, fast model for everyday questions, or a stronger one when you need it. You'll always see the cost.",
  },
  {
    icon: CreditCard,
    title: "Pay only for what you ask",
    body: "No subscription to lock into. Top up a little at a time — with a card or in Naira — and pay per question.",
  },
];

const KEY = "askzero-tour-v1-done";

export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={finish}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl">
        <button
          onClick={finish}
          aria-label="Skip"
          className="press absolute right-3 top-3 rounded-md p-1 text-text-tertiary hover:bg-surface hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent">
            <Icon className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Welcome to AskZero
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
            {s.title}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
            {s.body}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-base",
                  i === step ? "w-4 bg-accent" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="press rounded-full px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface hover:text-foreground transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className="press rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              {last ? "Start chatting" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
