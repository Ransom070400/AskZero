"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput, type ImageSize } from "@/components/chat/chat-input";
import { ModelPicker, type ModelOption } from "@/components/chat/model-picker";
import type { Message, Attachment, ArtifactRef } from "@/components/chat/message-bubble";
import type { ChatStyle } from "@/lib/system-prompt";
import { ArtifactPanel } from "@/components/artifact/artifact-panel";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";

// Detect natural-language image requests. Returns the cleaned prompt
// to send to the image API, or null if not an image request.
//
// We only fire on explicit "verb + image-noun" pairs because false positives
// here are expensive (100 credits charged for a misrouted chat). Examples
// that should match: "draw me a sunset", "generate an image of a cat",
// "make a picture of a dog". Examples that should NOT match: "describe this
// picture", "what's in the image".
function detectImageIntent(text: string): string | null {
  const re =
    /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:draw|generate|create|make|render|paint|design|produce|sketch)\s+(?:me\s+)?(?:a|an|the|some)?\s*(?:image|picture|photo|photograph|illustration|drawing|render|artwork|logo|icon|poster|sketch)\s+(?:of\s+|showing\s+|with\s+|that\s+)?(.+)/i;
  const m = text.match(re);
  if (!m) return null;
  const subject = m[1].trim().replace(/[.!?]+$/, "");
  if (subject.length < 2) return null;
  return subject;
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
  // Ephemeral incognito session — the reserved id "incognito" never maps to a
  // real chat row, so nothing loads, persists, or shows in history.
  const isIncognito = chatId === "incognito";
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
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024");
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  // Lifts the composer above the iOS software keyboard (see hook for why).
  const keyboardInset = useKeyboardInset();
  const initialSent = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Always-current transcript for the incognito history payload (sendMessage's
  // deps intentionally exclude `messages`, so read the latest via this ref).
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("askzero:chat-style");
    if (saved === "default" || saved === "concise" || saved === "explanatory" || saved === "code") {
      setStyle(saved);
    }
    const savedSize = localStorage.getItem("askzero:image-size");
    if (
      savedSize === "1024x1024" ||
      savedSize === "1024x1792" ||
      savedSize === "1792x1024"
    ) {
      setImageSize(savedSize);
    }
  }, []);

  const updateStyle = useCallback((next: ChatStyle) => {
    setStyle(next);
    localStorage.setItem("askzero:chat-style", next);
  }, []);

  const updateImageSize = useCallback((next: ImageSize) => {
    setImageSize(next);
    localStorage.setItem("askzero:image-size", next);
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

  // The active model's vision capability — drives the input gate and the
  // image-attachment cleanup when the user switches to a text-only model.
  const activeModelSupportsImages = (() => {
    if (!selectedModel) return true; // permissive until we know
    const found = models.find(
      (m) =>
        m.provider === selectedModel.provider && m.model === selectedModel.model
    );
    return found?.supportsImages ?? false;
  })();

  // If the user picks a text-only model while images are queued, drop them
  // — sending them would just trigger an upstream 400.
  useEffect(() => {
    if (activeModelSupportsImages) return;
    setAttachments((prev) => {
      const filtered = prev.filter((f) => !f.type.startsWith("image/"));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [activeModelSupportsImages]);

  // Load existing messages (last 100 for performance) + their artifacts.
  // Hides soft-deleted rows (replaced via edit) — those are still in the DB
  // and reachable via the "view previous version" UI. Falls back to the
  // legacy schema (no deleted_at / replaces_id) when the edit-branches
  // migration hasn't been applied yet.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isIncognito) return; // nothing to load — ephemeral session
    const supabase = createClient();
    const loadMessages = async () => {
      const primary = await supabase
        .from("messages")
        .select("id, role, content, token_count, cost_credits, metadata, replaces_id")
        .eq("chat_id", chatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);
      if (primary.error?.code === "42703") {
        return supabase
          .from("messages")
          .select("id, role, content, token_count, cost_credits, metadata")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true })
          .limit(100);
      }
      return primary;
    };
    Promise.all([
      loadMessages(),
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
            replaces_id?: string | null;
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
            replacesId: m.replaces_id ?? undefined,
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

  const runImageGeneration = useCallback(
    async (prompt: string, displayContent: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayContent,
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
          body: JSON.stringify({ chatId, prompt, size: imageSize }),
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
    },
    [chatId, imageSize]
  );

  const sendMessage = useCallback(
    async (text: string, opts: { replacesId?: string } = {}) => {
      if ((!text.trim() && attachments.length === 0) || isStreaming || !selectedModel) return;

      // Picker-selected image model: every plain prompt becomes an image
      // generation request. Strip an optional /image prefix so the slash
      // command still feels natural when this model is active.
      if (selectedModel.provider.startsWith("image:")) {
        const prompt = text.trim().replace(/^\/(?:image|img)\s+/i, "");
        if (!prompt) return;
        if (attachments.length > 0) setAttachments([]);
        await runImageGeneration(prompt, `/image ${prompt}`);
        return;
      }

      // Slash command: /image <prompt> | /img <prompt>
      const imageMatch = text.trim().match(/^\/(?:image|img)\s+([\s\S]+)$/i);
      if (imageMatch) {
        const prompt = imageMatch[1].trim();
        if (!prompt) return;
        await runImageGeneration(prompt, `/image ${prompt}`);
        return;
      }

      // Auto-detect natural-language image requests when no attachments are
      // present. Conservative regex — only fires on explicit verbs paired
      // with explicit nouns (image/picture/photo/etc) so chat questions
      // like "describe this picture" or "what's in this image" don't trigger.
      if (attachments.length === 0) {
        const detected = detectImageIntent(text.trim());
        if (detected) {
          await runImageGeneration(detected, text.trim());
          return;
        }
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
        replacesId: opts.replacesId,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

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
            replacesId: opts.replacesId,
            incognito: isIncognito,
            // Ephemeral: the server has nothing to load, so we send the
            // in-memory transcript (prior turns + this message).
            ...(isIncognito
              ? {
                  history: [
                    ...messagesRef.current
                      .filter((m) => m.content && m.role !== "system")
                      .map((m) => ({ role: m.role, content: m.content })),
                    { role: "user", content: text.trim() },
                  ],
                }
              : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          const raw = String(err.error || "");
          let errorContent: string;
          if (raw === "Insufficient credits") {
            errorContent =
              "Insufficient credits. [Deposit funds](/deposit) to continue.";
          } else if (/not a multimodal model/i.test(raw)) {
            errorContent =
              "This model can't read images — pick a multimodal model from the picker, or remove the image attachments.";
          } else {
            errorContent = `Error: ${raw || "Something went wrong"}`;
          }
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
              if (
                parsed.type === "thinking" ||
                parsed.type === "tool" ||
                parsed.type === "tool_result"
              ) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, steps: [...(m.steps ?? []), parsed] }
                      : m
                  )
                );
              }
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
                          // adopt the persisted DB id so the receipt lookup works
                          id: parsed.messageId ?? m.id,
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
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? aborted
                ? { ...m, content: m.content || "_(stopped)_" }
                : { ...m, content: "Error: Failed to get response" }
              : m
          )
        );
      } finally {
        abortRef.current = null;
      }

      setIsStreaming(false);
    },
    [chatId, isStreaming, selectedModel, attachments, style, runImageGeneration]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

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

      // Soft-delete the original user message and its downstream tail via
      // RPC, then attach the new message to it via replaces_id. Old branches
      // stay in the DB so the UI can offer "view previous version".
      // Optimistic-only messages (client UUIDs never persisted) are dropped
      // locally; nothing to soft-delete server-side for those.
      setMessages((prev) => prev.slice(0, idx));

      const supabase = createClient();
      const { error } = await supabase.rpc("supersede_message", {
        p_message_id: messageId,
      });
      if (error) {
        console.error("supersede_message failed:", error);
      }

      sendMessage(newContent, { replacesId: messageId });
    },
    [messages, isStreaming, sendMessage]
  );

  const handleRegenerateImage = useCallback(
    (messageId: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx <= 0) return;

      // Find the user message that produced this image — typically the
      // immediately preceding message. Strip the /image prefix the API
      // adds when it persists the prompt.
      const prevUser = [...messages]
        .slice(0, idx)
        .reverse()
        .find((m) => m.role === "user");
      if (!prevUser) return;
      const prompt = prevUser.content
        .replace(/^\/(?:image|img)\s+/i, "")
        .trim();
      if (!prompt) return;

      // Drop the existing assistant image so the regenerated one takes its place
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      runImageGeneration(prompt, `/image ${prompt}`);
    },
    [messages, isStreaming, runImageGeneration]
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

  // Deep-link from sidebar search: scroll the targeted message into view
  // once it's actually rendered, then briefly flash it. We retry on a few
  // frames because messages load async and the hash exists before the DOM.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#msg-")) return;
    if (messages.length === 0) return;
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-accent/60", "rounded-2xl");
    // Drop the hash so subsequent renders don't keep suppressing
    // the bottom-scroll behavior in <ChatList>.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-accent/60", "rounded-2xl");
    }, 1600);
    return () => clearTimeout(t);
  }, [messages.length]);

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "flex h-full flex-col transition-[width] duration-base ease-out",
          openArtifactId ? "hidden md:flex md:w-[60%]" : "w-full"
        )}
      >
      {isIncognito && (
        <div className="flex items-center justify-center gap-2 border-b border-border/60 bg-surface/60 px-4 py-2 text-center text-[12px] text-text-secondary">
          <EyeOff className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span>
            <b className="font-semibold text-foreground">Incognito</b> — this chat
            isn&apos;t saved and won&apos;t be remembered. You&apos;re still charged
            per message, and the model still processes your prompt (in a TEE).
          </span>
        </div>
      )}
      <ChatList
        messages={messages}
        isStreaming={isStreaming}
        onRegenerate={handleRegenerate}
        onRegenerateImage={handleRegenerateImage}
        onEdit={handleEdit}
        onOpenArtifact={setOpenArtifactId}
        onOpenAsArtifact={handleOpenAsArtifact}
        hideReceipts={isIncognito}
      />

      <div
        className="px-4 pt-3 pb-3 md:px-6 md:pt-4 md:pb-5"
        style={keyboardInset ? { marginBottom: keyboardInset } : undefined}
      >
        <div className="mx-auto max-w-chat space-y-3">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage(input)}
            disabled={isStreaming}
            isStreaming={isStreaming}
            onStop={handleStop}
            attachments={attachments}
            onAttach={(files) => setAttachments((prev) => [...prev, ...files].slice(0, 5))}
            onRemoveAttachment={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
            style={style}
            onStyleChange={updateStyle}
            imageSize={imageSize}
            onImageSizeChange={updateImageSize}
            allowImages={activeModelSupportsImages}
          />

          {/* Status row — model picker + helper text */}
          <div className="flex items-center justify-between gap-3 px-2">
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
        <div className="fixed inset-0 z-50 bg-background md:relative md:z-auto md:flex-1 md:border-l md:border-border/70">
          <ArtifactPanel
            artifactId={openArtifactId}
            onClose={() => setOpenArtifactId(null)}
          />
        </div>
      )}
    </div>
  );
}
