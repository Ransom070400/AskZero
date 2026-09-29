"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import {
  ArrowUpRight,
  Compass,
  PenLine,
  Code2,
  BarChart3,
  ShieldCheck,
  Wallet,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  {
    id: "explore",
    label: "Explore",
    icon: Compass,
    prompts: [
      "Answer a question, then show me how to verify the receipt",
      "Explain a hard topic in simple terms",
      "Help me draft a message I'm nervous to send",
      "Give me a study plan for this week",
    ],
  },
  {
    id: "create",
    label: "Create",
    icon: PenLine,
    prompts: [
      "Write a launch tweet thread for a Web3 app",
      "Draft a warm outreach email to a potential investor",
      "Brainstorm 10 names for an AI note-taking app",
      "Turn these bullet points into a blog intro",
    ],
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    prompts: [
      "Build a React balance card with a top-up button",
      "Write a Solidity function to batch-transfer ERC-20s",
      "Explain and fix a stack trace I'll paste",
      "Refactor a function from callbacks to async/await",
    ],
  },
  {
    id: "analyze",
    label: "Analyze",
    icon: BarChart3,
    prompts: [
      "Compare Postgres vs MongoDB across 5 dimensions in a table",
      "Chart a value that doubles over 8 periods",
      "Summarize the risks in a SaaS pricing model",
      "Break down the tradeoffs of a monorepo vs polyrepo",
    ],
  },
];

// Why AskZero over a generic AI chat — the three things that actually make it
// different, shown once at the empty state so a first-time user gets the pitch.
const WHY = [
  {
    icon: ShieldCheck,
    title: "Prove it",
    desc: "Every answer gets a tamper-evident receipt anchored on 0G — verify it can't be quietly changed.",
  },
  {
    icon: Wallet,
    title: "Pay your way",
    desc: "No subscription. Pay by the message — in naira, USD, or 0G tokens.",
  },
  {
    icon: Layers,
    title: "One tool for everything",
    desc: "Chat, deep research, code builds, and image generation — one balance.",
  },
];

interface EmptyStateProps {
  // The composer, rendered centred under the wordmark (Kimi-style).
  composer: React.ReactNode;
  onSuggestionClick: (text: string) => void;
}

// Entrance animation — CSS (tailwindcss-animate), so content is never stuck
// invisible if JS animation frames are throttled (e.g. a background tab).
const enter = "animate-in fade-in-0 slide-in-from-bottom-2 duration-700 fill-mode-both";

export function EmptyState({ composer, onSuggestionClick }: EmptyStateProps) {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  return (
    <div className="mx-auto flex w-full max-w-chat flex-1 flex-col items-center justify-center px-1 py-10 md:py-16">
      <div className={cn(enter, "mb-8")}>
        <Logo size={52} animated />
      </div>

      {/* relative z-10: the entrance transform makes each block its own
          stacking context, so without it the suggestions below would paint
          over the composer's menus. */}
      <div className={cn(enter, "relative z-10 w-full delay-100")}>
        {composer}
      </div>

      {/* Suggestions: category tabs + prompts for the active one */}
      <div className={cn(enter, "mt-6 w-full delay-200")}>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-fast",
                  isActive
                    ? "border-border-strong bg-elevated text-foreground"
                    : "border-border/70 text-text-tertiary hover:bg-elevated hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>

        <div
          key={category.id}
          className="mt-3 grid w-full grid-cols-1 gap-2 animate-in fade-in-0 duration-300 md:grid-cols-2"
        >
          {category.prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSuggestionClick(p)}
              className="press group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-[14px] text-text-secondary transition-colors duration-fast hover:bg-elevated hover:text-foreground"
            >
              <span className="leading-snug">{p}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors duration-fast group-hover:text-accent" />
            </button>
          ))}
        </div>
      </div>

      {/* Why AskZero — one quiet line instead of three cards */}
      <div
        className={cn(
          enter,
          "mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 delay-300"
        )}
      >
        {WHY.map((w) => {
          const Icon = w.icon;
          return (
            <span
              key={w.title}
              title={w.desc}
              className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary"
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              {w.title}
            </span>
          );
        })}
      </div>
    </div>
  );
}
