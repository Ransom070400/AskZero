"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type Message } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

interface ChatListProps {
  messages: Message[];
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onRegenerateImage?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenArtifact?: (artifactId: string) => void;
  onOpenAsArtifact?: (
    messageId: string,
    body: { type: string; title: string; language: string | null; content: string }
  ) => void;
}

export function ChatList({ messages, isStreaming, onRegenerate, onRegenerateImage, onEdit, onOpenArtifact, onOpenAsArtifact }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't yank the viewport to the bottom on initial load when the user
    // arrived via a deep-link to a specific message (sidebar search hit).
    if (
      typeof window !== "undefined" &&
      window.location.hash.startsWith("#msg-")
    ) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-chat space-y-4 md:space-y-6 px-3 md:px-4 py-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
            isStreaming={isStreaming}
            onRegenerate={!isStreaming ? onRegenerate : undefined}
            onRegenerateImage={!isStreaming ? onRegenerateImage : undefined}
            onEdit={!isStreaming ? onEdit : undefined}
            onOpenArtifact={onOpenArtifact}
            onOpenAsArtifact={onOpenAsArtifact}
          />
        ))}
        {isStreaming &&
          (messages[messages.length - 1]?.role !== "assistant" ||
            !messages[messages.length - 1]?.content) && (
            <TypingIndicator />
          )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
