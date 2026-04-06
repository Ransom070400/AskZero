"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { MessageSquare, Copy, Check } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number | null;
  costCredits?: number | null;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="rounded p-1 text-text-tertiary hover:text-foreground transition-colors duration-150"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
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
    <div className="relative group">
      <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {lang && <span className="text-micro uppercase text-text-tertiary">{lang}</span>}
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
    return (
      <div className="flex justify-end px-1 md:px-0">
        <div className="max-w-[88%] md:max-w-[75%] rounded-2xl rounded-br-md bg-surface px-3.5 py-2.5 md:px-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
        <MessageSquare className="h-4 w-4 text-text-tertiary" />
      </div>
      <div className="flex-1 space-y-1 overflow-hidden min-w-0">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_pre]:rounded-md [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:text-sm [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            remarkPlugins={[remarkGfm]}
            components={{ code: CodeBlock as never }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <CopyBtn text={message.content} />
          {isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-micro text-text-tertiary hover:text-foreground transition-colors duration-150"
            >
              Retry
            </button>
          )}
          {message.tokenCount != null && (
            <span className="text-micro text-text-tertiary">
              {message.tokenCount} tokens
              {message.costCredits != null && ` · ${message.costCredits}c`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
