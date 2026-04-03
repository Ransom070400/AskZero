"use client";

import { MessageSquare, Sparkles } from "lucide-react";

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
    <div className="flex flex-1 flex-col items-center justify-center space-y-6 max-w-2xl mx-auto px-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-3xl font-bold tracking-tight">AskZero</h1>
      </div>
      <p className="text-center text-muted-foreground">
        AI powered by decentralized compute. Ask anything to get started.
      </p>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-lg border border-border/50 bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{suggestion}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
