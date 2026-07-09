"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { MessageBubble, type Message } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

interface ChatListProps {
  messages: Message[];
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onRegenerateWith?: (m: { provider: string; model: string }) => void;
  regenModels?: { provider: string; model: string; label: string; kind?: string }[];
  onRegenerateImage?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenArtifact?: (artifactId: string) => void;
  onOpenAsArtifact?: (
    messageId: string,
    body: { type: string; title: string; language: string | null; content: string }
  ) => void;
  hideReceipts?: boolean;
}

// How close to the bottom (px) still counts as "following the conversation".
const NEAR_BOTTOM_PX = 120;

export function ChatList({ messages, isStreaming, onRegenerate, onRegenerateWith, regenModels, onRegenerateImage, onEdit, onOpenArtifact, onOpenAsArtifact, hideReceipts }: ChatListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Only animate messages that arrive *after* mount — the initial history load
  // (and switching chats) should paint instantly, not cascade.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        <div className="mx-auto max-w-chat space-y-4 md:space-y-6 px-4 py-4">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            return (
              <motion.div
                key={msg.id}
                initial={mounted ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
              >
                <MessageBubble
                  message={msg}
                  isLast={isLast}
                  isStreaming={isStreaming}
                  onRegenerate={!isStreaming ? onRegenerate : undefined}
                  onRegenerateWith={!isStreaming ? onRegenerateWith : undefined}
                  regenModels={regenModels}
                  onRegenerateImage={!isStreaming ? onRegenerateImage : undefined}
                  onEdit={!isStreaming ? onEdit : undefined}
                  onOpenArtifact={onOpenArtifact}
                  onOpenAsArtifact={onOpenAsArtifact}
                  hideReceipt={hideReceipts}
                />
              </motion.div>
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
