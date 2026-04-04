"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import type { Message } from "@/components/chat/message-bubble";

interface ModelOption {
  provider: string;
  model: string;
  label: string;
}

export default function ChatDetailPage() {
  return (
    <Suspense>
      <ChatDetailContent />
    </Suspense>
  );
}

function ChatDetailContent() {
  const { id: chatId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  }>({ provider: "mock", model: "default" });
  const initialSent = useRef(false);

  // Load models
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models);
      })
      .catch(() => {});
  }, []);

  // Load existing messages
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("messages")
      .select("id, role, content, token_count, cost_credits")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              role: m.role as Message["role"],
              content: m.content,
              tokenCount: m.token_count,
              costCredits: m.cost_credits,
            }))
          );
        }
      });
  }, [chatId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message: text.trim(),
            model: selectedModel.model,
            provider:
              selectedModel.provider !== "mock"
                ? selectedModel.provider
                : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          const errorContent =
            err.error === "Insufficient credits"
              ? "Insufficient credits. [Deposit funds](/deposit) to continue."
              : `Error: ${err.error || "Something went wrong"}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: errorContent } : m
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
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }
              if (parsed.usage) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          tokenCount: parsed.usage.output_tokens,
                          costCredits: parsed.usage.cost,
                        }
                      : m
                  )
                );
              }
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
    [chatId, isStreaming, selectedModel]
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
        <div className="mx-auto max-w-2xl space-y-2">
          {/* Model selector */}
          {models.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Model:</label>
              <select
                value={`${selectedModel.provider}|${selectedModel.model}`}
                onChange={(e) => {
                  const [provider, model] = e.target.value.split("|");
                  setSelectedModel({ provider, model });
                }}
                className="rounded-md border border-border/50 bg-muted px-2 py-1 text-xs"
                disabled={isStreaming}
              >
                {models.map((m) => (
                  <option
                    key={`${m.provider}|${m.model}`}
                    value={`${m.provider}|${m.model}`}
                  >
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
