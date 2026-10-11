"use client";

import { Suspense, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { EyeOff, ImageIcon, Telescope } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatList } from "@/components/chat/chat-list";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import { toast } from "@/lib/toast";
import {
  ChatInput,
  IMAGE_SIZES,
  type ImageSize,
  type SlashCommand,
} from "@/components/chat/chat-input";
import { ModelPicker } from "@/components/chat/model-picker";
import { CostMeter } from "@/components/chat/cost-meter";
import type {
  Message,
  Attachment,
  ArtifactRef,
  AgentStep,
} from "@/components/chat/message-bubble";
import { readSSE, createTokenBatcher, CHATS_CHANGED_EVENT } from "@/lib/chat-stream";

// One event from /api/chat's stream (fields vary by event).
interface StreamEvent {
  content?: string;
  reasoning?: string;
  promoteReasoning?: boolean;
  userMessageId?: string;
  error?: string;
  code?: string;
  type?: string;
  finishReason?: string | null;
  usage?: { input_tokens: number; output_tokens: number; cost: number };
  messageId?: string | null;
  artifacts?: ArtifactRef[];
}
import { CHAT_STYLES, type ChatStyle } from "@/lib/system-prompt";
import dynamic from "next/dynamic";

// The artifact workspace (renderers, live React preview) only loads when an
// artifact is opened.
const ArtifactPanel = dynamic(
  () => import("@/components/artifact/artifact-panel").then((m) => m.ArtifactPanel),
  { ssr: false }
);
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useModelSelection } from "@/hooks/use-model-selection";
import { setIncognitoHasMessages } from "@/lib/incognito-state";
import { ExitIncognito } from "@/components/chat/exit-incognito";
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
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const {
    models,
    selected: selectedModel,
    select: setSelectedModel,
    active: activeModel,
  } = useModelSelection();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [style, setStyle] = useState<ChatStyle>("default");
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024");
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  // Lifts the composer above the iOS software keyboard (see hook for why).
  const keyboardInset = useKeyboardInset();
  const initialSent = useRef(false);
  // Opened from the home screen with a client-made id: the chat row doesn't
  // exist until its first message creates it (see chat/page.tsx). Read once,
  // since ?new is dropped from the URL after that message is sent.
  const startedNew = useRef(searchParams.get("new") === "1");
  const abortRef = useRef<AbortController | null>(null);
  // Set synchronously on send, so a second Enter during the upload step (before
  // isStreaming has re-rendered) can't send the message twice.
  const sendingRef = useRef(false);
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

  // Let the exit-incognito controls know whether leaving would discard
  // anything, so they can confirm first.
  const hasConversation = isIncognito && messages.length > 0;
  useEffect(() => {
    setIncognitoHasMessages(hasConversation);
  }, [hasConversation]);
  useEffect(() => () => setIncognitoHasMessages(false), []);

  // Short display name for the model that wrote an answer; falls back to the
  // raw id (minus any vendor prefix) for models no longer listed.
  const modelName = useCallback(
    (m: { provider: string; model: string }) => {
      const found =
        models.find((x) => x.provider === m.provider && x.model === m.model) ??
        models.find((x) => x.model === m.model);
      return found ? found.label.split(" · ")[0] : m.model.replace(/^.*\//, "");
    },
    [models]
  );

  // Stable props for <ChatList>: its bubbles are memoised, so a new array or
  // inline arrow here would re-render every message on every streamed token.
  const regenModels = useMemo(() => models.filter((m) => !m.comingSoon), [models]);
  const handleQuote = useCallback(
    (q: string) => setInput(`About "${q.replace(/\s+/g, " ").trim()}": `),
    []
  );

  // The active model's vision capability — drives the input gate and the
  // image-attachment cleanup when the user switches to a text-only model.
  const activeModelSupportsImages = (() => {
    if (!selectedModel) return true; // permissive until we know
    return activeModel?.supportsImages ?? false;
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

  // Draft persistence — restore an unsent message when opening a chat. Never
  // for incognito (nothing about it should be saved), and skipped when a ?q=
  // auto-send is pending.
  useEffect(() => {
    if (isIncognito || searchParams.get("q")) return;
    try {
      const draft = localStorage.getItem(`askzero-draft-${chatId}`);
      if (draft) setInput(draft);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (isIncognito) return;
    try {
      if (input.trim()) localStorage.setItem(`askzero-draft-${chatId}`, input);
      else localStorage.removeItem(`askzero-draft-${chatId}`);
    } catch {
      /* ignore */
    }
  }, [input, chatId, isIncognito]);

  useEffect(() => {
    if (isIncognito) return; // nothing to load — ephemeral session
    // A chat just started from the home screen has no history yet (its row
    // is created with the first message).
    if (startedNew.current) return;
    setLoadingHistory(true);
    const supabase = createClient();
    const loadMessages = async () => {
      const primary = await supabase
        .from("messages")
        .select("id, role, content, token_count, cost_credits, metadata, replaces_id")
        .eq("chat_id", chatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (primary.error?.code === "42703") {
        return supabase
          .from("messages")
          .select("id, role, content, token_count, cost_credits, metadata")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(100);
      }
      return primary;
    };
    // A late response for a chat we've already left must not overwrite it.
    let cancelled = false;
    Promise.all([
      loadMessages(),
      supabase
        .from("artifacts")
        .select("id, message_id, type, title")
        .eq("chat_id", chatId),
      // Which model wrote each answer — the receipt records it.
      supabase
        .from("inference_receipts")
        .select("message_id, provider, model")
        .eq("chat_id", chatId),
    ]).then(([msgRes, artRes, receiptRes]) => {
      if (cancelled) return;
      const answeredBy = new Map<string, { provider: string; model: string }>();
      for (const r of (receiptRes.data ?? []) as {
        message_id: string;
        provider: string;
        model: string;
      }[]) {
        answeredBy.set(r.message_id, { provider: r.provider, model: r.model });
      }
      const data = msgRes.data as
        | {
            id: string;
            role: string;
            content: string;
            token_count: number | null;
            cost_credits: number | null;
            metadata?: { attachments?: Attachment[]; activity?: AgentStep[] };
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
        // Fetched newest-first so long chats show their LAST 100 messages;
        // display them chronologically.
        data.reverse();
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as Message["role"],
            content: m.content,
            tokenCount: m.token_count,
            costCredits: m.cost_credits,
            attachments: m.metadata?.attachments,
            // The answer's saved agent steps: its activity timeline and sources.
            steps: m.metadata?.activity,
            artifacts: byMessage.get(m.id),
            replacesId: m.replaces_id ?? undefined,
            answeredBy: answeredBy.get(m.id),
          }))
        );
      }
      setLoadingHistory(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    const results = await Promise.all(
      files.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        form.append("chatId", chatId);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: form });
          if (res.ok) return (await res.json()) as Attachment;
        } catch {
          // reported below
        }
        toast.error(`Couldn't upload ${file.name}`);
        return null;
      })
    );
    return results.filter((a): a is Attachment => a !== null);
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

  // Suggested follow-ups for a finished answer (see FollowupChips).
  const loadFollowups = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/followups`, { method: "POST" });
      if (!res.ok) return;
      const { followups } = (await res.json()) as { followups?: string[] };
      if (!followups?.length) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, followups } : m))
      );
    } catch {
      // suggestions are optional
    }
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      opts: {
        replacesId?: string;
        model?: { provider: string; model: string };
        // Already-uploaded attachments to resend (edit / retry of a turn).
        attachments?: Attachment[];
      } = {}
    ) => {
      const resent = opts.attachments ?? [];
      if (
        (!text.trim() && attachments.length === 0 && resent.length === 0) ||
        isStreaming ||
        sendingRef.current ||
        !selectedModel
      )
        return;
      sendingRef.current = true;
      try {

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
        let uploadedAttachments: Attachment[] = resent;
        const filesToUpload = [...attachments];
        setAttachments([]);

        if (filesToUpload.length > 0) {
          uploadedAttachments = [...resent, ...(await uploadFiles(filesToUpload))];
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
          {
            id: assistantId,
            role: "assistant",
            content: "",
            answeredBy: opts.model ?? selectedModel,
            startedAt: Date.now(),
          },
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
              model: opts.model?.model ?? selectedModel!.model,
              provider: opts.model?.provider ?? selectedModel!.provider,
              attachments: uploadedAttachments,
              style,
              replacesId: opts.replacesId,
              incognito: isIncognito,
              // First message of a chat started from the home screen: the
              // server creates the chat row (see chat/page.tsx).
              createChat: startedNew.current && messagesRef.current.length === 0,
              // Ephemeral: the server has nothing to load, so we send the
              // in-memory transcript (prior turns + this message). An edit or
              // retry replaces a turn, so the transcript stops before it.
              ...(isIncognito
                ? {
                    history: [
                      ...messagesRef.current
                        .slice(
                          0,
                          opts.replacesId
                            ? Math.max(
                                0,
                                messagesRef.current.findIndex((m) => m.id === opts.replacesId)
                              )
                            : undefined
                        )
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
            const err = await res.json().catch(() => ({}));
            const raw = String(err.error || "");
            let errorContent: string;
            let toastMsg: string;
            if (res.status === 429) {
              errorContent =
                "Rate limited — too many requests. Wait a moment, then hit Retry.";
              toastMsg = "Rate limited — try again shortly";
            } else if (raw === "Insufficient credits") {
              errorContent =
                "Insufficient credits. [Deposit funds](/deposit) to continue.";
              toastMsg = "Insufficient credits";
            } else if (/not a multimodal model/i.test(raw)) {
              errorContent =
                "This model can't read images — pick a multimodal model from the picker, or remove the image attachments.";
              toastMsg = "Model can't read images";
            } else {
              errorContent = `Error: ${raw || "Something went wrong"}`;
              toastMsg = "Message failed — hit Retry";
            }
            toast.error(toastMsg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: errorContent } : m
              )
            );
            setIsStreaming(false);
            return;
          }

          const updateAssistant = (fn: (m: Message) => Message) =>
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
          const tokens = createTokenBatcher((content, reasoning) =>
            updateAssistant((m) => ({
              ...m,
              ...(reasoning
                ? {
                    reasoning: (m.reasoning ?? "") + reasoning,
                    thinkingStartedAt: m.thinkingStartedAt ?? Date.now(),
                  }
                : {}),
              ...(content
                ? {
                    content: m.content + content,
                    answerStartedAt: m.answerStartedAt ?? Date.now(),
                    // First answer token ends the thinking phase.
                    thinkingMs:
                      m.thinkingMs ??
                      (m.thinkingStartedAt ? Date.now() - m.thinkingStartedAt : undefined),
                  }
                : {}),
            }))
          );

          // Set when the answer was saved complete; follow-ups are then
          // suggested for it (after the stream, so they never delay it).
          let savedAnswerId: string | null = null;
          let streamFailed = false;
          const finishedOk = (e: StreamEvent) =>
            !streamFailed && e.finishReason !== "length";
          try {
            await readSSE<StreamEvent>(res.body!, (parsed) => {
              if (parsed.content || typeof parsed.reasoning === "string") {
                tokens.push({ content: parsed.content, reasoning: parsed.reasoning });
                return;
              }
              // Anything else applies after the text received before it.
              tokens.flush();

              if (typeof parsed.userMessageId === "string") {
                // Adopt the persisted id so edit/retry can supersede this turn.
                const persistedId = parsed.userMessageId;
                setMessages((prev) =>
                  prev.map((m) => (m.id === userMsg.id ? { ...m, id: persistedId } : m))
                );
                // The chat row exists now (a new chat's is created with its
                // first message), so the sidebar can show it.
                window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
                return;
              }

              // The server can decline mid-stream (e.g. the real input size
              // pushes the cost past the balance) or the model can fail
              // partway. Keep whatever streamed before the failure.
              if (parsed.error) {
                streamFailed = true;
                const streamErr = String(parsed.error);
                const insufficient =
                  parsed.code === "insufficient_credits" ||
                  streamErr === "Insufficient credits";
                const note = insufficient
                  ? "Insufficient credits. [Deposit funds](/deposit) to continue."
                  : streamErr;
                toast.error(insufficient ? "Insufficient credits" : streamErr);
                updateAssistant((m) => ({
                  ...m,
                  content: m.content
                    ? `${m.content}\n\n_${note}_`
                    : insufficient
                      ? note
                      : `Error: ${note}`,
                }));
                return;
              }
              if (parsed.finishReason === "length") {
                updateAssistant((m) => ({
                  ...m,
                  content: `${m.content}\n\n_The answer hit the length limit. Ask to continue._`,
                }));
              }
              if (
                parsed.type === "thinking" ||
                parsed.type === "tool" ||
                parsed.type === "tool_result"
              ) {
                const step = { ...(parsed as AgentStep), at: Date.now() };
                updateAssistant((m) => ({ ...m, steps: [...(m.steps ?? []), step] }));
              }
              if (parsed.promoteReasoning) {
                // The server decided the "reasoning" was really the answer.
                updateAssistant((m) => ({
                  ...m,
                  content: (m.reasoning ?? "") + m.content,
                  reasoning: undefined,
                  thinkingStartedAt: undefined,
                  thinkingMs: undefined,
                }));
              }
              if (parsed.usage) {
                // The answer is saved and a new chat has its title.
                window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
                const { usage, messageId, artifacts } = parsed;
                if (messageId && finishedOk(parsed)) savedAnswerId = messageId;
                updateAssistant((m) => ({
                  ...m,
                  // adopt the persisted DB id so the receipt lookup works
                  id: messageId ?? m.id,
                  tokenCount: usage.output_tokens,
                  costCredits: usage.cost,
                  artifacts: artifacts ?? m.artifacts,
                }));
                if (artifacts && artifacts.length > 0) {
                  setOpenArtifactId((current) => current ?? artifacts[0].id);
                }
              }
            });
          } finally {
            tokens.flush();
          }
          if (savedAnswerId) void loadFollowups(savedAnswerId);
        } catch (err) {
          const aborted =
            err instanceof DOMException && err.name === "AbortError";
          if (!aborted) toast.error("Network error — check your connection");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? aborted
                  ? { ...m, content: m.content || "_(stopped)_" }
                  : {
                      ...m,
                      // Keep any tokens that streamed before the drop.
                      content:
                        m.content ||
                        "Network error — check your connection and hit Retry.",
                    }
                : m
            )
          );
        } finally {
          abortRef.current = null;
        }

        setIsStreaming(false);
      } finally {
        sendingRef.current = false;
      }
    },
    [chatId, isStreaming, selectedModel, attachments, style, runImageGeneration, loadFollowups]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // Leaving the chat (navigating away or switching chats) stops its stream.
  // The server keeps and bills the partial answer, so it's there on return;
  // left running, the reader would keep updating a chat no longer on screen.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [chatId]);

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

  // Edit and retry both replace a user turn: soft-delete it and everything
  // after it (supersede_message), then resend — with the turn's attachments —
  // as a new message pointing back via replaces_id. Old branches stay in the
  // DB so the UI can offer "view previous version". A turn that never reached
  // the DB (it failed before saving) has nothing to supersede, so it's simply
  // dropped locally and resent as a fresh message.
  const replaceTurn = useCallback(
    async (
      original: Message,
      content: string,
      model?: { provider: string; model: string }
    ) => {
      const idx = messagesRef.current.findIndex((m) => m.id === original.id);
      if (idx < 0) return;

      let replacesId: string | undefined;
      if (isIncognito) {
        replacesId = original.id;
      } else {
        const { error } = await createClient().rpc("supersede_message", {
          p_message_id: original.id,
        });
        if (!error) replacesId = original.id;
      }

      setMessages((prev) => prev.slice(0, idx));
      sendMessage(content, {
        replacesId,
        model,
        attachments: original.attachments,
      });
    },
    [isIncognito, sendMessage]
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (isStreaming) return;
      const original = messages.find((m) => m.id === messageId);
      if (!original) return;
      await replaceTurn(original, newContent);
    },
    [messages, isStreaming, replaceTurn]
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

  const regenerate = useCallback(
    (modelOverride?: { provider: string; model: string }) => {
      // Retry = replace the last user turn with itself, so the old answer is
      // superseded instead of the question being stored twice.
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUserMsg || isStreaming) return;
      replaceTurn(lastUserMsg, lastUserMsg.content, modelOverride);
    },
    [messages, isStreaming, replaceTurn]
  );

  // Keep a no-arg version for the click handler (so the click event never
  // leaks in as a "model"), plus a variant that regenerates with another model.
  const handleRegenerate = useCallback(() => regenerate(), [regenerate]);
  const handleRegenerateWith = useCallback(
    (m: { provider: string; model: string }) => regenerate(m),
    [regenerate]
  );

  // Stable across renders (bubbles are memoised); always sends with the
  // latest sendMessage.
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;
  const handleFollowup = useCallback((text: string) => {
    void sendRef.current(text);
  }, []);

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
      // Drop ?q / ?new so a reload shows the chat instead of sending the
      // message again (and, for a new chat, skipping its history).
      history.replaceState(null, "", window.location.pathname + window.location.hash);
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
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border/60 bg-surface/60 px-4 py-2 text-center text-xs text-text-secondary">
          <EyeOff className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span title="You're still charged per message, and your prompt is processed privately in a secure enclave.">
            <b className="font-semibold text-foreground">Incognito</b> — not saved,
            not remembered. Still charged per message.
          </span>
          <ExitIncognito>
            <button
              type="button"
              className="press ml-1 shrink-0 rounded-full border border-border/70 bg-elevated px-2.5 py-1 text-xs font-semibold text-foreground transition-colors duration-fast hover:border-border-strong"
            >
              Exit
            </button>
          </ExitIncognito>
        </div>
      )}
      {loadingHistory && messages.length === 0 ? (
        <ChatSkeleton />
      ) : (
      <ChatList
        messages={messages}
        isStreaming={isStreaming}
        modelLabel={activeModel?.label}
        modelName={modelName}
        onRegenerate={handleRegenerate}
        onRegenerateWith={handleRegenerateWith}
        regenModels={regenModels}
        onRegenerateImage={handleRegenerateImage}
        onEdit={handleEdit}
        onOpenArtifact={setOpenArtifactId}
        onOpenAsArtifact={handleOpenAsArtifact}
        hideReceipts={isIncognito}
        onTransform={(instruction) => sendMessage(instruction)}
        onQuote={handleQuote}
        onFollowup={handleFollowup}
      />
      )}

      <div
        className="px-4 pt-3 pb-3 md:px-6 md:pt-4 md:pb-5"
        style={keyboardInset ? { marginBottom: keyboardInset } : undefined}
      >
        <div className="mx-auto max-w-chat">
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
            allowImages={activeModelSupportsImages}
            toolbarRight={
              <>
                <span className="hidden min-w-0 sm:inline-flex">
                  <CostMeter
                    promptText={input}
                    model={selectedModel?.model}
                    rate={activeModel?.pricePer1k}
                    hasAttachments={attachments.length > 0}
                    isStreaming={isStreaming}
                  />
                </span>
                {models.length > 0 && selectedModel && (
                  <ModelPicker
                    models={models}
                    selected={selectedModel}
                    disabled={isStreaming}
                    onSelect={setSelectedModel}
                    settings={[
                      {
                        id: "style",
                        label: "Answer style",
                        value: style,
                        options: CHAT_STYLES,
                        onChange: (v) => updateStyle(v as ChatStyle),
                      },
                      {
                        id: "image-size",
                        label: "Image size",
                        value: imageSize,
                        options: IMAGE_SIZES.map((sz) => ({
                          id: sz.id,
                          label: `${sz.label} · ${sz.hint}`,
                        })),
                        onChange: (v) => updateImageSize(v as ImageSize),
                      },
                    ]}
                  />
                )}
              </>
            }
            commands={[
              {
                id: "research",
                label: "Research",
                description: "Cited multi-source report",
                icon: Telescope,
                run: () => router.push("/research"),
              },
              {
                id: "incognito",
                label: "Incognito",
                description: "Not saved, not remembered",
                icon: EyeOff,
                run: () => router.push("/chat/incognito"),
              },
              {
                id: "image",
                label: "Image",
                description: "Generate a picture",
                icon: ImageIcon,
                run: () => setInput("generate an image of "),
              },
            ] satisfies SlashCommand[]}
          />

        </div>
      </div>
      </div>
      {openArtifactId && (
        <div className="fixed inset-0 z-overlay bg-background md:relative md:z-auto md:flex-1 md:border-l md:border-border/70">
          <ArtifactPanel
            artifactId={openArtifactId}
            onClose={() => setOpenArtifactId(null)}
          />
        </div>
      )}
    </div>
  );
}
