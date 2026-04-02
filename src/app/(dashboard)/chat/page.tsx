"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { useState } from "react";

const suggestions = [
  "How does 0G decentralized AI work?",
  "Explain blockchain inference",
  "What can AskZero help me with?",
  "Compare centralized vs decentralized AI",
];

export default function ChatPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-full flex-col items-center justify-between p-4">
      {/* Empty State */}
      <div className="flex flex-1 flex-col items-center justify-center space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">AskZero</h1>
        </div>
        <p className="text-center text-muted-foreground">
          AI powered by decentralized compute. Ask anything to get started.
        </p>

        {/* Suggestion Cards */}
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setMessage(suggestion)}
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

      {/* Message Input */}
      <div className="w-full max-w-2xl pb-4">
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message AskZero..."
            className="min-h-[52px] resize-none rounded-xl border-border/50 bg-muted pr-12"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                // Will handle sending in a future milestone
              }
            }}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-lg"
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          AskZero uses 0G Compute for decentralized AI inference
        </p>
      </div>
    </div>
  );
}
