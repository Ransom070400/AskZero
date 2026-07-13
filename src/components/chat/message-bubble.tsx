"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import { remarkAlert } from "remark-github-blockquote-alert";
import { remarkDetails } from "@/lib/remark-details";
import { useCurrency } from "@/lib/currency";
import { Copy, Check, Download, ExternalLink, FileText, FileCode, History, Pencil, RotateCw, X, Search, Calculator, Globe, Loader2, WrapText, ListOrdered, Share2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import removeMarkdown from "remove-markdown";
import { MermaidBlock } from "./mermaid-block";
import { ChartBlock } from "./chart-block";
import { ReceiptBadge } from "./receipt-badge";

// Markdown paragraph that fades in when it first appears. As the last paragraph
// grows during streaming its element persists (same position), so it fades once
// rather than flickering per token.
function FadeP(props: React.HTMLAttributes<HTMLParagraphElement>) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <p
      {...props}
      style={{ opacity: shown ? 1 : 0, transition: "opacity 0.4s ease" }}
    />
  );
}

// Live agent "thinking" trace — reasoning + tool steps shown above the answer.
function StepsTrace({ steps, active }: { steps: AgentStep[]; active: boolean }) {
  const toolLabel = (tool?: string) =>
    tool === "web_search"
      ? "Searching the web"
      : tool === "calculate"
        ? "Calculating"
        : "Reading page";
  const ToolIcon = ({ tool }: { tool?: string }) => {
    const cls = "h-3.5 w-3.5 text-accent shrink-0";
    if (tool === "calculate") return <Calculator className={cls} />;
    if (tool === "fetch_url") return <Globe className={cls} />;
    return <Search className={cls} />;
  };
  return (
    <div className="mb-2 space-y-1.5 border-l-2 border-accent/25 pl-3">
      {steps.map((s, i) => {
        if (s.type === "thinking") {
          return (
            <p key={i} className="text-[13px] italic leading-snug text-text-tertiary">
              {s.text}
            </p>
          );
        }
        if (s.type === "tool") {
          return (
            <div key={i} className="flex items-center gap-1.5 text-[13px] text-text-secondary">
              <ToolIcon tool={s.tool} />
              <span>
                {toolLabel(s.tool)}
                {s.input ? <span className="text-accent"> · {s.input}</span> : null}
              </span>
            </div>
          );
        }
        return null;
      })}
      {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
    </div>
  );
}

interface PreContextValue {
  messageId: string;
  onOpenAsArtifact: (
    messageId: string,
    body: { type: string; title: string; language: string | null; content: string }
  ) => void;
}

const PreContext = createContext<PreContextValue | null>(null);

export interface Attachment {
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
  extractedText?: string;
}

export interface ArtifactRef {
  id: string;
  type: string;
  title: string;
}

export interface AgentStep {
  type: "thinking" | "tool" | "tool_result";
  text?: string;
  tool?: string;
  input?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number | null;
  costCredits?: number | null;
  attachments?: Attachment[];
  artifacts?: ArtifactRef[];
  // Live agent "thinking" trace (search/reason steps) shown above the answer.
  steps?: AgentStep[];
  // Set when this message was created by editing a previous user message.
  // The "view previous version" button surfaces the superseded thread.
  replacesId?: string;
}

function ActionButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
    >
      {children}
    </button>
  );
}

function ShareBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const clean = removeMarkdown(text);
    // Native share sheet where available (mobile / supported desktop);
    // otherwise fall back to copying the answer to the clipboard.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: clean });
      } catch {
        /* user dismissed the sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={share}
      aria-label="Share"
      className="press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}

function RegenerateMenu({
  onRegenerate,
  onRegenerateWith,
  models,
}: {
  onRegenerate: () => void;
  onRegenerateWith?: (m: { provider: string; model: string }) => void;
  models?: { provider: string; model: string; label: string; kind?: string }[];
}) {
  const chatModels = (models ?? []).filter((m) => m.kind !== "image");
  // No model list → plain Retry (current model).
  if (!onRegenerateWith || chatModels.length === 0) {
    return (
      <ActionButton label="Regenerate" onClick={onRegenerate}>
        <RotateCw className="h-3.5 w-3.5" />
        Retry
      </ActionButton>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Regenerate"
          className="press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={onRegenerate}>
          <RotateCw className="mr-2 h-3.5 w-3.5 text-text-tertiary" />
          Same model
        </DropdownMenuItem>
        {chatModels.map((m) => (
          <DropdownMenuItem
            key={`${m.provider}|${m.model}`}
            onClick={() => onRegenerateWith({ provider: m.provider, model: m.model })}
          >
            <span className="truncate">{m.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CopyBtn({
  text,
  size = "md",
  markdown,
}: {
  text: string;
  size?: "sm" | "md";
  // When true, strip markdown so the pasted text is clean (no ** or # etc.).
  markdown?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const small = size === "sm";
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(markdown ? removeMarkdown(text) : text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      aria-label={copied ? "Copied" : "Copy"}
      className={
        small
          ? "press inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-tertiary hover:bg-background/60 hover:text-foreground transition-colors duration-fast ease-out"
          : "press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
      }
    >
      {copied ? (
        <Check className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ) : (
        <Copy className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Walks the rendered code tree (after rehype-highlight has transformed it
// into nested spans) to recover the plain text for copy.
function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function PreBlock({ children }: { children?: React.ReactNode }) {
  const ctx = useContext(PreContext);
  const [wrap, setWrap] = useState(false);
  const [showNums, setShowNums] = useState(false);
  const codeEl = React.Children.toArray(children).find(
    (c): c is React.ReactElement<{
      className?: string;
      children?: React.ReactNode;
    }> => React.isValidElement(c)
  );

  const className = codeEl?.props.className ?? "";
  // Supports a filename hint: ```ts:src/app.ts  → lang "ts", filename "src/app.ts"
  const langMatch = className.match(/language-([\w+-]+)(?::(.+))?/);
  const lang = langMatch?.[1] ?? "";
  const filename = langMatch?.[2] ?? "";
  const text = extractText(codeEl?.props.children).replace(/\n$/, "");

  if (lang === "mermaid") {
    return <MermaidBlock code={text} />;
  }

  if (lang === "chart") {
    return <ChartBlock code={text} />;
  }

  const handleOpen = () => {
    if (!ctx) return;
    const inferred = inferArtifactType(lang, text);
    ctx.onOpenAsArtifact(ctx.messageId, {
      type: inferred.type,
      title: inferred.title,
      language: lang || null,
      content: text,
    });
  };

  const lineCount = text.split("\n").length;
  const showGutter = showNums && !wrap;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/70 bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-elevated/40 px-3 py-1">
        <span className="min-w-0 truncate text-[11px] font-medium text-text-tertiary">
          {filename ? (
            <span className="font-mono">{filename}</span>
          ) : (
            <span className="uppercase tracking-wider">{lang || "code"}</span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => setWrap((w) => !w)}
            aria-label="Toggle soft wrap"
            title="Wrap"
            className={`press inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-fast ${wrap ? "bg-background/60 text-accent" : "text-text-tertiary hover:bg-background/60 hover:text-foreground"}`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowNums((n) => !n)}
            aria-label="Toggle line numbers"
            title="Line numbers"
            className={`press inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-fast ${showNums ? "bg-background/60 text-accent" : "text-text-tertiary hover:bg-background/60 hover:text-foreground"}`}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          {ctx && (
            <button
              onClick={handleOpen}
              aria-label="Open in artifact panel"
              className="press inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-tertiary hover:bg-background/60 hover:text-foreground transition-colors duration-fast"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </button>
          )}
          <CopyBtn text={text} size="sm" />
        </div>
      </div>
      <div className="flex">
        {showGutter && (
          <pre
            aria-hidden
            className="select-none border-r border-border/60 py-4 pl-4 pr-3 text-right text-[13px] leading-relaxed text-text-tertiary/50 tabular-nums"
          >
            {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
          </pre>
        )}
        <pre
          className={`p-4 text-[13px] leading-relaxed ${
            wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"
          } ${showGutter ? "flex-1" : ""}`}
        >
          {children}
        </pre>
      </div>
    </div>
  );
}

function inferArtifactType(
  lang: string,
  body: string
): { type: string; title: string } {
  const low = lang.toLowerCase();
  const trimmed = body.trim();
  if (low === "html" || /^<!doctype html/i.test(trimmed)) {
    return { type: "html", title: "HTML document" };
  }
  if (low === "svg" || /^<svg[\s>]/i.test(trimmed)) {
    return { type: "svg", title: "SVG graphic" };
  }
  if (low === "jsx" || low === "tsx") {
    return { type: "react", title: "React component" };
  }
  if (low === "md" || low === "markdown") {
    return { type: "markdown", title: "Markdown" };
  }
  return { type: "code", title: lang ? `${lang.toUpperCase()} snippet` : "Snippet" };
}

export function MessageBubble({
  message,
  onRegenerate,
  onRegenerateImage,
  onEdit,
  onOpenArtifact,
  onOpenAsArtifact,
  isLast,
  isStreaming,
  hideReceipt,
  onRegenerateWith,
  regenModels,
}: {
  message: Message;
  onRegenerate?: () => void;
  onRegenerateWith?: (m: { provider: string; model: string }) => void;
  regenModels?: { provider: string; model: string; label: string; kind?: string }[];
  onRegenerateImage?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenArtifact?: (artifactId: string) => void;
  onOpenAsArtifact?: PreContextValue["onOpenAsArtifact"];
  isLast?: boolean;
  isStreaming?: boolean;
  hideReceipt?: boolean;
}) {
  const isUser = message.role === "user";
  const { formatCost } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showPrev, setShowPrev] = useState(false);
  const [prevMessages, setPrevMessages] = useState<
    | {
        id: string;
        role: string;
        content: string;
        metadata?: { attachments?: Attachment[] };
      }[]
    | null
  >(null);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const fetchPrev = async () => {
    if (!message.replacesId || prevMessages) {
      setShowPrev((s) => !s);
      return;
    }
    setLoadingPrev(true);
    try {
      const res = await fetch(`/api/messages/${message.replacesId}/history`);
      if (res.ok) {
        const data = await res.json();
        setPrevMessages(data.messages || []);
        setShowPrev(true);
      }
    } finally {
      setLoadingPrev(false);
    }
  };

  if (isUser) {
    const images = message.attachments?.filter((a) => a.type.startsWith("image/")) || [];
    const files = message.attachments?.filter((a) => !a.type.startsWith("image/")) || [];

    if (editing) {
      const submitEdit = () => {
        const trimmed = editValue.trim();
        if (!trimmed || !onEdit) return;
        setEditing(false);
        onEdit(message.id, trimmed);
      };
      return (
        <div className="flex justify-end">
          <div className="w-full max-w-[85%] md:max-w-[72%] rounded-3xl rounded-br-lg bg-elevated border border-accent/40 px-4 py-3 shadow-sm">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              autoFocus
              rows={Math.min(8, Math.max(1, editValue.split("\n").length))}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground caret-accent outline-none"
            />
            <div className="mt-2 flex justify-end gap-1">
              <button
                onClick={() => setEditing(false)}
                className="press inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={!editValue.trim()}
                className="press inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
              >
                Save & resend
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div id={`msg-${message.id}`} className="group/user flex flex-col items-end scroll-mt-20">
        {showPrev && prevMessages && prevMessages.length > 0 && (
          <div className="mb-2 w-full max-w-[85%] md:max-w-[72%] space-y-2 rounded-2xl border border-dashed border-border/70 bg-surface/60 p-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <History className="h-3 w-3" /> Previous version
              </span>
              <button
                onClick={() => setShowPrev(false)}
                aria-label="Hide previous version"
                className="press inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-elevated hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {prevMessages.map((pm) => (
              <div
                key={pm.id}
                className={
                  pm.role === "user"
                    ? "rounded-xl bg-elevated/60 px-3 py-2 text-[13px] leading-relaxed text-text-secondary whitespace-pre-wrap"
                    : "rounded-xl px-3 py-2 text-[13px] leading-relaxed text-text-secondary whitespace-pre-wrap"
                }
              >
                {pm.role !== "user" && (
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Assistant
                  </span>
                )}
                {pm.content || <em className="text-text-tertiary">(empty)</em>}
              </div>
            ))}
          </div>
        )}
        <div className="relative max-w-[85%] md:max-w-[72%] rounded-3xl rounded-br-lg bg-elevated border border-border/70 px-5 py-3 shadow-sm">
          {message.content && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
              {message.content}
            </p>
          )}
          {images.length > 0 && (
            <div className={`${message.content ? "mt-3" : ""} flex flex-wrap gap-2`}>
              {images.map((att) => (
                <a key={att.path} href={att.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-h-56 rounded-2xl object-contain border border-border/70"
                  />
                </a>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className={`${message.content || images.length ? "mt-3" : ""} space-y-1.5`}>
              {files.map((att) => (
                <a
                  key={att.path}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[13px] text-accent hover:text-accent-hover transition-colors duration-fast"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-medium">{att.name}</span>
                  <span className="text-text-tertiary">
                    {(att.size / 1024).toFixed(0)} KB
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
        {(onEdit || message.replacesId) && message.content && (
          <div className="mt-1 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/user:opacity-100 transition-opacity duration-base ease-out">
            {onEdit && (
              <button
                onClick={() => {
                  setEditValue(message.content);
                  setEditing(true);
                }}
                aria-label="Edit message"
                className="press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {message.replacesId && (
              <button
                onClick={fetchPrev}
                disabled={loadingPrev}
                aria-label={showPrev ? "Hide previous version" : "View previous version"}
                className="press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out disabled:opacity-50"
              >
                <History className="h-3.5 w-3.5" />
                {loadingPrev ? "Loading…" : showPrev ? "Hide previous" : "Previous version"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const showCursor = isStreaming && isLast;
  const assistantImages =
    message.attachments?.filter((a) => a.type.startsWith("image/")) ?? [];

  return (
    <div id={`msg-${message.id}`} className="group scroll-mt-20">
      {message.steps && message.steps.length > 0 && (
        <StepsTrace steps={message.steps} active={!message.content} />
      )}
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[1.7] text-foreground
          [&_p]:my-3
          [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display
          [&_h1]:tracking-tight [&_h2]:tracking-tight [&_h3]:tracking-tight
          [&_code]:rounded-md [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:font-medium
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal
          [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline
          [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_blockquote]:italic
          [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1
          [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:whitespace-nowrap [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-border [&_td]:p-2 [&_td]:border-b [&_td]:border-border/40"
      >
        <PreContext.Provider
          value={
            onOpenAsArtifact
              ? { messageId: message.id, onOpenAsArtifact }
              : null
          }
        >
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            remarkPlugins={[remarkGfm, remarkMath, remarkAlert, remarkDirective, remarkDetails]}
            components={{ pre: PreBlock as never, p: FadeP as never }}
          >
            {message.content}
          </ReactMarkdown>
        </PreContext.Provider>
        {showCursor && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1em] w-[2px] -mb-[2px] bg-foreground/80 animate-pulse align-text-bottom"
          />
        )}
      </div>
      {assistantImages.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {assistantImages.map((att) => (
            <div
              key={att.path}
              className="group/img relative overflow-hidden rounded-2xl border border-border/70 bg-elevated/40"
            >
              <a href={att.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.url}
                  alt={att.name}
                  className="block max-h-[480px] w-auto object-contain"
                />
              </a>
              <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/img:opacity-100 transition-opacity duration-fast">
                <a
                  href={att.url}
                  download={att.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Download image"
                  className="press inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/85 text-background shadow-sm hover:bg-foreground transition-colors duration-fast"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {onRegenerateImage && (
                  <button
                    onClick={() => onRegenerateImage(message.id)}
                    aria-label="Regenerate image"
                    className="press inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/85 text-background shadow-sm hover:bg-foreground transition-colors duration-fast"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {message.artifacts && message.artifacts.length > 0 && onOpenArtifact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.artifacts.map((art) => (
            <button
              key={art.id}
              onClick={() => onOpenArtifact(art.id)}
              className="press group/art inline-flex items-center gap-2 rounded-xl border border-border/70 bg-elevated/60 px-3 py-2 text-left transition-[border-color,background-color] duration-fast ease-out hover:border-border-strong hover:bg-elevated"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                <FileCode className="h-3.5 w-3.5" />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-foreground">
                  {art.title || "Artifact"}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
                  {art.type}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-base ease-out">
        <CopyBtn text={message.content} markdown />
        {message.content && <ShareBtn text={message.content} />}
        {isLast && onRegenerate && (
          <RegenerateMenu
            onRegenerate={onRegenerate}
            onRegenerateWith={onRegenerateWith}
            models={regenModels}
          />
        )}
        {message.content && !hideReceipt && <ReceiptBadge messageId={message.id} />}
        {message.tokenCount != null && (
          <span
            className="ml-1 text-[11px] font-medium text-text-tertiary tabular-nums"
            title={
              message.costCredits != null
                ? `${message.tokenCount} tokens · ${message.costCredits} credits`
                : `${message.tokenCount} tokens`
            }
          >
            {message.tokenCount} tokens
            {message.costCredits != null && ` · ${formatCost(message.costCredits)}`}
          </span>
        )}
      </div>
    </div>
  );
}
