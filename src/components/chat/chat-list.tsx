"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
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

// How close to the bottom (px) still counts as "following the conversation".
const NEAR_BOTTOM_PX = 120;

export function ChatList({ messages, isStreaming, onRegenerate, onRegenerateImage, onEdit, onOpenArtifact, onOpenAsArtifact }: ChatListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const updateAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < NEAR_BOTTOM_PX);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-follow new content ONLY when the user is already near the bottom, so
  // we never yank someone who has scrolled up to read earlier messages. Use an
  // instant jump while streaming (smooth-scrolling on every token thrashes and
  // feels laggy on mobile) and a smooth scroll when a finished message lands.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.hash.startsWith("#msg-")
    ) {
      return;
    }
    if (!atBottom) return;
    scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [messages, isStreaming, atBottom, scrollToBottom]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={updateAtBottom}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto max-w-chat space-y-4 md:space-y-6 px-3 md:px-4 py-4">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            return (
              <div
                key={msg.id}
                className={isLast ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out" : undefined}
              >
                <MessageBubble
                  message={msg}
                  isLast={isLast}
                  isStreaming={isStreaming}
                  onRegenerate={!isStreaming ? onRegenerate : undefined}
                  onRegenerateImage={!isStreaming ? onRegenerateImage : undefined}
                  onEdit={!isStreaming ? onEdit : undefined}
                  onOpenArtifact={onOpenArtifact}
                  onOpenAsArtifact={onOpenAsArtifact}
                />
              </div>
            );
          })}
          {isStreaming &&
            (messages[messages.length - 1]?.role !== "assistant" ||
              !messages[messages.length - 1]?.content) && (
              <TypingIndicator />
            )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Jump-to-latest — appears only when the user has scrolled away. */}
      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to latest"
          className="press absolute bottom-3 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border/70 bg-elevated/90 text-foreground shadow-md backdrop-blur-sm transition-opacity duration-base ease-out animate-in fade-in-0 zoom-in-95 hover:border-border-strong"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
