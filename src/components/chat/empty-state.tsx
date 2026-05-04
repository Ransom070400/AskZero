"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { ArrowUpRight } from "lucide-react";

const suggestions = [
  "How does 0G decentralized AI work?",
  "Explain blockchain inference",
  "What can AskZero help me with?",
  "Compare centralized vs decentralized AI",
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

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
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
        Ask anything. Powered by 0G decentralized compute.
      </motion.p>

      <motion.div
        variants={item}
        className="mt-10 grid w-full grid-cols-1 gap-2 md:grid-cols-2 md:gap-3"
      >
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="press group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-elevated/60 px-4 py-3.5 text-left text-[14px] text-text-secondary transition-[border-color,background-color,color] duration-base ease-out hover:border-border-strong hover:bg-elevated hover:text-foreground"
          >
            <span className="leading-snug">{s}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors duration-fast group-hover:text-accent" />
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
