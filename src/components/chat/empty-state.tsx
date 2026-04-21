"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";

const suggestions = [
  "How does 0g decentralized ai work?",
  "Explain blockchain inference",
  "What can askzero help me with?",
  "Compare centralized vs decentralized ai",
];

const container = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

const item = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
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
      className="flex flex-1 flex-col items-center justify-center max-w-chat mx-auto px-4"
    >
      <motion.div variants={item} className="mb-4 md:mb-5">
        <Logo size={32} animated />
      </motion.div>
      <motion.h1
        variants={item}
        className="font-display text-2xl md:text-4xl font-bold mb-6 md:mb-10 tracking-tight"
      >
        what can i help you with?
      </motion.h1>
      {/* Desktop: inline dots */}
      <motion.div
        variants={item}
        className="hidden md:flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      >
        {suggestions.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-text-tertiary">·</span>}
            <button
              onClick={() => onSuggestionClick(s)}
              className="text-sm text-text-secondary hover:text-accent transition-colors duration-150"
            >
              {s}
            </button>
          </span>
        ))}
      </motion.div>
      {/* Mobile: stacked buttons */}
      <motion.div variants={item} className="flex md:hidden flex-col gap-2 w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="w-full rounded-2xl border border-border bg-elevated px-4 py-3 text-sm text-left text-text-secondary hover:text-foreground hover:border-border-strong transition-all duration-150 active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
