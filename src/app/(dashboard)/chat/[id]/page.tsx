"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, User } from "lucide-react";
import { useState } from "react";

const placeholderMessages = [
  {
    role: "user" as const,
    content: "How does 0G work?",
  },
  {
    role: "assistant" as const,
    content:
      "0G (Zero Gravity) is a modular, infinitely scalable data availability layer for Web3. It uses a novel architecture that separates data availability sampling from data storage, enabling high throughput while maintaining decentralization.\n\nKey components include:\n\n- **Data Availability Layer**: Ensures data is available for verification without requiring all nodes to store everything.\n- **Decentralized Storage**: Distributed storage network for persistent data.\n- **Compute Network**: Enables decentralized AI inference and computation.\n\n0G achieves significantly higher throughput than traditional blockchains, making it ideal for data-intensive applications like AI and gaming.",
  },
];

export default function ChatDetailPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-4">
          {placeholderMessages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <Avatar className="mt-1 h-7 w-7 shrink-0">
                <AvatarFallback
                  className={
                    msg.role === "assistant"
                      ? "bg-primary text-primary-foreground text-xs"
                      : "bg-muted text-muted-foreground text-xs"
                  }
                >
                  {msg.role === "assistant" ? (
                    <MessageSquare className="h-3.5 w-3.5" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">
                  {msg.role === "assistant" ? "AskZero" : "You"}
                </p>
                <div className="prose prose-sm prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-border/50 p-4">
        <div className="mx-auto max-w-2xl">
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
        </div>
      </div>
    </div>
  );
}
