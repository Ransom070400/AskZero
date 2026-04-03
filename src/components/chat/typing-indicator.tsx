"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-7 w-7 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          <MessageSquare className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 pt-2">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
    </div>
  );
}
