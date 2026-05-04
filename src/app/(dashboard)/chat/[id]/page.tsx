"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import type { Message, Attachment } from "@/components/chat/message-bubble";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelOption {
  provider: string;
  model: string;
  label: string;
  description?: string;
}

function currentLabel(
  models: ModelOption[],
  selected: { provider: string; model: string }
): string | null {
  return (
    models.find(
      (m) => m.provider === selected.provider && m.model === selected.model
    )?.label ?? null
  );
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
  } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const initialSent = useRef(false);

  // Load models
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models);
        if (data.models.length > 0 && !selectedModel) {
          setSelectedModel({
            provider: data.models[0].provider,
            model: data.models[0].model,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Load existing messages (last 100 for performance)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("messages")
      .select("id, role, content, token_count, cost_credits, metadata")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }: { data: { id: string; role: string; content: string; token_count: number | null; cost_credits: number | null; metadata?: { attachments?: Attachment[] } }[] | null }) => {
        if (data && data.length > 0) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              role: m.role as Message["role"],
              content: m.content,
              tokenCount: m.token_count,
              costCredits: m.cost_credits,
              attachments: m.metadata?.attachments,
            }))
          );
        }
      });
  }, [chatId]);

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    const uploaded: Attachment[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("chatId", chatId);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        uploaded.push(await res.json());
      }
    }
    return uploaded;
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if ((!text.trim() && attachments.length === 0) || isStreaming || !selectedModel) return;

      // Upload files first
      let uploadedAttachments: Attachment[] = [];
      const filesToUpload = [...attachments];
      setAttachments([]);

      if (filesToUpload.length > 0) {
        uploadedAttachments = await uploadFiles(filesToUpload);
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
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
            model: selectedModel!.model,
            provider: selectedModel!.provider,
            attachments: uploadedAttachments,
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
    [chatId, isStreaming, selectedModel, attachments]
  );

  const handleRegenerate = useCallback(() => {
    // Find the last user message and resend it
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg || isStreaming) return;

    // Remove last assistant message
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === "assistant");
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return prev;
    });

    sendMessage(lastUserMsg.content);
  }, [messages, isStreaming, sendMessage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle initial message from /chat redirect.
  // Wait for selectedModel — sendMessage early-returns when it's null,
  // and we'd lose the q permanently because initialSent flips before retry.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialSent.current && selectedModel) {
      initialSent.current = true;
      sendMessage(q);
    }
  }, [searchParams, sendMessage, selectedModel]);

  return (
    <div className="flex h-full flex-col">
      <ChatList
        messages={messages}
        isStreaming={isStreaming}
        onRegenerate={handleRegenerate}
      />

      <div className="px-3 pt-3 pb-3 md:px-6 md:pt-4 md:pb-5">
        <div className="mx-auto max-w-chat space-y-3">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage(input)}
            disabled={isStreaming}
            attachments={attachments}
            onAttach={(files) => setAttachments((prev) => [...prev, ...files].slice(0, 5))}
            onRemoveAttachment={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
          />

          {/* Status row — model picker + helper text */}
          <div className="flex items-center justify-between gap-3 px-1">
            {models.length > 0 && selectedModel ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isStreaming}
                    className="press group inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-elevated/60 px-3 py-1 text-[12px] font-semibold text-text-secondary transition-[border-color,background-color,color] duration-fast ease-out hover:border-border-strong hover:text-foreground disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3 text-accent" />
                    <span>{currentLabel(models, selectedModel) ?? "Select model"}</span>
                    <ChevronDown className="h-3 w-3 text-text-tertiary group-hover:text-foreground transition-colors duration-fast" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {models.map((m) => {
                    const active =
                      m.provider === selectedModel.provider &&
                      m.model === selectedModel.model;
                    return (
                      <DropdownMenuItem
                        key={`${m.provider}|${m.model}`}
                        onClick={() =>
                          setSelectedModel({ provider: m.provider, model: m.model })
                        }
                      >
                        <div className="flex flex-1 flex-col items-start gap-0.5">
                          <span className={cn("text-[13px]", active ? "font-semibold text-foreground" : "font-medium")}>
                            {m.label}
                          </span>
                          {m.description && (
                            <span className="text-[11px] font-normal text-text-tertiary">
                              {m.description}
                            </span>
                          )}
                        </div>
                        {active && <Check className="ml-2 h-3.5 w-3.5 text-accent" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span />
            )}

            <p className="hidden md:block text-[11px] text-text-tertiary">
              <kbd className="mr-1 rounded bg-elevated/80 px-1 py-0.5 text-[10px] font-medium">⌘/</kbd>
              focus input ·{" "}
              <kbd className="mx-1 rounded bg-elevated/80 px-1 py-0.5 text-[10px] font-medium">↵</kbd>
              send
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
