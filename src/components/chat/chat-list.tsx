"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type Message } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

interface ChatListProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function ChatList({ messages, isStreaming }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <TypingIndicator />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
