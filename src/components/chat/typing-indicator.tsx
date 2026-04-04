"use client";

import { MessageSquare } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
        <MessageSquare className="h-4 w-4 text-text-tertiary" />
      </div>
      <div className="flex items-center gap-1 pt-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary [animation-delay:400ms]" />
      </div>
    </div>
  );
}
