"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import type { Message } from "@/components/chat/message-bubble";

export default function ChatDetailPage() {
  const { id: chatId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const initialSent = useRef(false);

  // Load existing messages
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("messages")
      .select("id, role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data as Message[]);
        }
      });
  }, [chatId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Optimistic: show user message immediately
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      // Create placeholder for assistant response
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message: text.trim() }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${err.error || "Something went wrong"}` }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.replace(/^data: /, "");
            if (trimmed === "[DONE]") continue;
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              );
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Error: Failed to get response" }
              : m
          )
        );
      }

      setIsStreaming(false);
    },
    [chatId, isStreaming]
  );

  // Handle initial message from /chat redirect
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialSent.current) {
      initialSent.current = true;
      sendMessage(q);
    }
  }, [searchParams, sendMessage]);

  return (
    <div className="flex h-full flex-col">
      <ChatList messages={messages} isStreaming={isStreaming} />

      <div className="border-t border-border/50 p-4">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage(input)}
            disabled={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
