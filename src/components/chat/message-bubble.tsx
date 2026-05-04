"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Copy, Check, FileText, RotateCw } from "lucide-react";

export interface Attachment {
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number | null;
  costCredits?: number | null;
  attachments?: Attachment[];
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

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      label={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </ActionButton>
  );
}

function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (!className) {
    return <code className={className} {...props}>{children}</code>;
  }

  const text = typeof children === "string" ? children : String(children || "");
  const lang = className?.replace("hljs language-", "").replace("language-", "");

  return (
    <div className="relative group/code my-4">
      <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover/code:opacity-100 transition-opacity duration-base ease-out">
        {lang && (
          <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            {lang}
          </span>
        )}
        <CopyBtn text={text.replace(/\n$/, "")} />
      </div>
      <code className={className} {...props}>{children}</code>
    </div>
  );
}

export function MessageBubble({
  message,
  onRegenerate,
  isLast,
}: {
  message: Message;
  onRegenerate?: () => void;
  isLast?: boolean;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    const images = message.attachments?.filter((a) => a.type.startsWith("image/")) || [];
    const files = message.attachments?.filter((a) => !a.type.startsWith("image/")) || [];

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[72%] rounded-3xl rounded-br-lg bg-elevated border border-border/60 px-5 py-3 shadow-sm">
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
                    className="max-h-56 rounded-2xl object-contain border border-border/60"
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
      </div>
    );
  }

  return (
    <div className="group">
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[1.7] text-foreground
          [&_p]:my-3
          [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display
          [&_h1]:tracking-tight [&_h2]:tracking-tight [&_h3]:tracking-tight
          [&_pre]:rounded-xl [&_pre]:bg-surface [&_pre]:border [&_pre]:border-border/60 [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed
          [&_code]:rounded-md [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:font-medium
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal
          [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline
          [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_blockquote]:italic
          [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1
          [&_table]:border-collapse [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-border [&_td]:p-2 [&_td]:border-b [&_td]:border-border/40"
      >
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          remarkPlugins={[remarkGfm]}
          components={{ code: CodeBlock as never }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-base ease-out">
        <CopyBtn text={message.content} />
        {isLast && onRegenerate && (
          <ActionButton label="Regenerate" onClick={onRegenerate}>
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </ActionButton>
        )}
        {message.tokenCount != null && (
          <span className="ml-1 text-[11px] font-medium text-text-tertiary tabular-nums">
            {message.tokenCount} tokens
            {message.costCredits != null && ` · ${message.costCredits}c`}
          </span>
        )}
      </div>
    </div>
  );
}
