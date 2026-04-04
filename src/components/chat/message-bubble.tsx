"use client";

import "highlight.js/styles/github-dark.css";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, User } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number | null;
  costCredits?: number | null;
}

export function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-7 w-7 shrink-0">
        <AvatarFallback
          className={
            isAssistant
              ? "bg-primary text-primary-foreground text-xs"
              : "bg-muted text-muted-foreground text-xs"
          }
        >
          {isAssistant ? (
            <MessageSquare className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1 overflow-hidden">
        <p className="text-sm font-medium">
          {isAssistant ? "AskZero" : "You"}
        </p>
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          {isAssistant ? (
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        {isAssistant && message.tokenCount != null && (
          <p className="text-[11px] text-muted-foreground/60">
            {message.tokenCount} tokens
            {message.costCredits != null && ` · ${message.costCredits} credits`}
          </p>
        )}
      </div>
    </div>
  );
}
