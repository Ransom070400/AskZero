"use client";

import { Logo } from "@/components/ui/logo";

const suggestions = [
  "How does 0g decentralized ai work?",
  "Explain blockchain inference",
  "What can askzero help me with?",
  "Compare centralized vs decentralized ai",
];

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center max-w-chat mx-auto px-4">
      <div className="mb-4 md:mb-5">
        <Logo size={32} animated />
      </div>
      <h1 className="text-lg md:text-xl font-medium mb-6 md:mb-8 tracking-tight">
        what can i help you with?
      </h1>
      {/* Desktop: inline dots */}
      <div className="hidden md:flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
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
      </div>
      {/* Mobile: stacked buttons */}
      <div className="flex md:hidden flex-col gap-2 w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-left text-text-secondary hover:text-foreground hover:border-border-strong transition-all duration-150 active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
