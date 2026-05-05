"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ModelPicker, type ModelOption } from "@/components/chat/model-picker";
import type { Message, Attachment, ArtifactRef } from "@/components/chat/message-bubble";
import type { ChatStyle } from "@/lib/system-prompt";
import { ArtifactPanel } from "@/components/artifact/artifact-panel";
import { cn } from "@/lib/utils";

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
  const [style, setStyle] = useState<ChatStyle>("default");
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const initialSent = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("askzero:chat-style");
    if (saved === "default" || saved === "concise" || saved === "explanatory" || saved === "code") {
      setStyle(saved);
    }
  }, []);

  const updateStyle = useCallback((next: ChatStyle) => {
    setStyle(next);
    localStorage.setItem("askzero:chat-style", next);
  }, []);

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

  // Load existing messages (last 100 for performance) + their artifacts
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("messages")
        .select("id, role, content, token_count, cost_credits, metadata")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(100),
      supabase
        .from("artifacts")
        .select("id, message_id, type, title")
        .eq("chat_id", chatId),
    ]).then(([msgRes, artRes]) => {
      const data = msgRes.data as
        | {
            id: string;
            role: string;
            content: string;
            token_count: number | null;
            cost_credits: number | null;
            metadata?: { attachments?: Attachment[] };
          }[]
        | null;
      const arts = (artRes.data ?? []) as {
        id: string;
        message_id: string;
        type: string;
        title: string;
      }[];
      const byMessage = new Map<string, ArtifactRef[]>();
      for (const a of arts) {
        const list = byMessage.get(a.message_id) ?? [];
        list.push({ id: a.id, type: a.type, title: a.title });
        byMessage.set(a.message_id, list);
      }
      if (data && data.length > 0) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as Message["role"],
            content: m.content,
            tokenCount: m.token_count,
            costCredits: m.cost_credits,
            attachments: m.metadata?.attachments,
            artifacts: byMessage.get(m.id),
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

      // Slash command: /image <prompt> | /img <prompt>
      const imageMatch = text.trim().match(/^\/(?:image|img)\s+([\s\S]+)$/i);
      if (imageMatch) {
        const prompt = imageMatch[1].trim();
        if (!prompt) return;

        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: `/image ${prompt}`,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsStreaming(true);

        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "Generating image…" },
        ]);

        try {
          const res = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, prompt }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const errorContent =
              err.error === "Insufficient credits"
                ? "Insufficient credits. [Deposit funds](/deposit) to continue."
                : `Error: ${err.error || "Image generation failed"}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: errorContent } : m
              )
            );
          } else {
            const data = (await res.json()) as {
              assistantMessage: {
                id: string;
                content: string;
                cost_credits: number;
                attachments: Attachment[];
              };
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      id: data.assistantMessage.id,
                      role: "assistant",
                      content: "",
                      costCredits: data.assistantMessage.cost_credits,
                      attachments: data.assistantMessage.attachments,
                    }
                  : m
              )
            );
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Error: Failed to generate image" }
                : m
            )
          );
        }
        setIsStreaming(false);
        return;
      }

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
            style,
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
                          artifacts: parsed.artifacts ?? m.artifacts,
                        }
                      : m
                  )
                );
                if (parsed.artifacts?.length > 0) {
                  setOpenArtifactId((current) => current ?? parsed.artifacts[0].id);
                }
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
    [chatId, isStreaming, selectedModel, attachments, style]
  );

  const handleOpenAsArtifact = useCallback(
    async (
      messageId: string,
      body: { type: string; title: string; language: string | null; content: string }
    ) => {
      try {
        const res = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, messageId, ...body }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { id: string; type: string; title: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  artifacts: [
                    ...(m.artifacts ?? []),
                    { id: data.id, type: data.type, title: data.title },
                  ],
                }
              : m
          )
        );
        setOpenArtifactId(data.id);
      } catch {
        // ignore — silent failure is acceptable for this manual action
      }
    },
    [chatId]
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;

      // Local ids and DB ids diverge: optimistic messages get a client UUID
      // that never matches the row Supabase generates, so a delete-by-id only
      // hits DB rows that were loaded from the server originally. That's fine
      // for the common case (editing a message after reload). Stale orphan
      // rows from the same session will surface on next page load.
      const tailIds = messages.slice(idx).map((m) => m.id);

      setMessages((prev) => prev.slice(0, idx));

      const supabase = createClient();
      if (tailIds.length > 0) {
        await supabase.from("messages").delete().in("id", tailIds);
      }

      sendMessage(newContent);
    },
    [messages, isStreaming, sendMessage]
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
    <div className="flex h-full">
      <div
        className={cn(
          "flex h-full flex-col transition-[width] duration-base ease-out",
          openArtifactId ? "hidden md:flex md:w-[60%]" : "w-full"
        )}
      >
      <ChatList
        messages={messages}
        isStreaming={isStreaming}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onOpenArtifact={setOpenArtifactId}
        onOpenAsArtifact={handleOpenAsArtifact}
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
            style={style}
            onStyleChange={updateStyle}
          />

          {/* Status row — model picker + helper text */}
          <div className="flex items-center justify-between gap-3 px-1">
            {models.length > 0 && selectedModel ? (
              <ModelPicker
                models={models}
                selected={selectedModel}
                disabled={isStreaming}
                onSelect={setSelectedModel}
              />
            ) : (
              <span />
            )}

            <p className="hidden md:block text-[11px] text-text-tertiary">
              <kbd className="mr-1 rounded bg-elevated/80 px-1 py-0.5 text-[10px] font-medium">⌘/</kbd>
              focus ·{" "}
              <kbd className="mx-1 rounded bg-elevated/80 px-1 py-0.5 text-[10px] font-medium">↵</kbd>
              send ·{" "}
              <code className="rounded bg-elevated/80 px-1 py-0.5 text-[10px] font-medium font-mono">/image</code>{" "}
              to generate
            </p>
          </div>
        </div>
      </div>
      </div>
      {openArtifactId && (
        <div className="fixed inset-0 z-50 bg-background md:relative md:z-auto md:flex-1 md:border-l md:border-border/60">
          <ArtifactPanel
            artifactId={openArtifactId}
            onClose={() => setOpenArtifactId(null)}
          />
        </div>
      )}
    </div>
  );
}
