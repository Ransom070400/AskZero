"use client";

import { MessageSquare } from "lucide-react";

const suggestions = [
  "How does 0G decentralized AI work?",
  "Explain blockchain inference",
  "What can AskZero help me with?",
  "Compare centralized vs decentralized AI",
];

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center max-w-chat mx-auto px-4">
      <MessageSquare className="h-8 w-8 text-text-tertiary mb-4" />
      <h1 className="text-xl font-semibold mb-8">What can I help you with?</h1>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
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
    </div>
  );
}
