"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
      "Explain a hard topic in simple terms",
      "Help me draft a message I'm nervous to send",
      "Give me a study plan for this week",
      "What can you help me with?",
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

const container = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

const item = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const prompts = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
};

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={container}
      className="mx-auto flex w-full max-w-chat flex-1 flex-col items-center justify-center px-5 py-12"
    >
      <motion.div variants={item} className="mb-7">
        <Logo size={40} animated />
      </motion.div>

      <motion.h1
        variants={item}
        className="font-display text-3xl md:text-5xl font-bold tracking-[-0.03em] text-center text-foreground"
      >
        what can i help you with?
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-3 text-center text-[15px] text-text-tertiary"
      >
        Ask anything. Private by design — we don&apos;t sell your data or train on your chats.
      </motion.p>

      {/* Category tabs */}
      <motion.div
        variants={item}
        className="mt-9 flex flex-wrap items-center justify-center gap-1.5"
      >
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-fast",
                isActive
                  ? "bg-accent-muted text-accent"
                  : "text-text-tertiary hover:bg-elevated hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </motion.div>

      {/* Example prompts for the active category */}
      <motion.div
        key={category.id}
        variants={prompts}
        initial="initial"
        animate="animate"
        className="mt-4 grid w-full grid-cols-1 gap-2 md:grid-cols-2 md:gap-3"
      >
        {category.prompts.map((s) => (
          <motion.button
            key={s}
            variants={item}
            onClick={() => onSuggestionClick(s)}
            className="press hover-lift group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-elevated/60 px-4 py-3.5 text-left text-[14px] text-text-secondary hover:border-border-strong hover:bg-elevated hover:text-foreground"
          >
            <span className="leading-snug">{s}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors duration-fast group-hover:text-accent" />
          </motion.button>
        ))}
      </motion.div>

      {/* Why AskZero — the pitch, once, for a first-time user */}
      <motion.div variants={item} className="mt-10 w-full">
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          Why AskZero
        </p>
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
          {WHY.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.title}
                className="rounded-2xl border border-border/60 bg-elevated/40 p-4"
              >
                <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">{w.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-text-tertiary">
                  {w.desc}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
