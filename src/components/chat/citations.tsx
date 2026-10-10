"use client";

import React, { createContext, useContext } from "react";
import { ArrowUpRight, CornerDownRight } from "lucide-react";
import { CITE_PREFIX } from "@/lib/citations";
import { cn } from "@/lib/utils";
import { Favicon, hostOf, type ActivitySource } from "./activity-panel";

// The sources of the answer being rendered, in citation order ([1] is
// sources[0]). Provided per answer; read by the markdown link renderer.
export const SourcesContext = createContext<ActivitySource[]>([]);

function CitationChip({ n }: { n: number }) {
  const sources = useContext(SourcesContext);
  const source = sources[n - 1];
  if (!source) return <sup>[{n}]</sup>;
  return (
    <span className="group/cite relative inline-block align-baseline">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source ${n}: ${source.title}`}
        className="mx-0.5 inline-flex h-[1.35em] -translate-y-px items-center gap-1 rounded-full border border-border/70 bg-surface px-1.5 align-middle text-[0.7em] font-semibold leading-none text-text-secondary no-underline transition-colors duration-fast hover:border-accent/60 hover:text-accent"
      >
        <Favicon url={source.url} className="h-[1.05em] w-[1.05em]" />
        {n}
      </a>
      {/* Hover card: title and site. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-floating mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-border bg-elevated p-3 text-left text-xs font-normal leading-snug shadow-xl group-hover/cite:block group-focus-within/cite:block animate-in fade-in-0 zoom-in-95"
      >
        <span className="mb-1 flex items-center gap-1.5 text-text-tertiary">
          <Favicon url={source.url} className="h-3.5 w-3.5" />
          {hostOf(source.url)}
        </span>
        <span className="line-clamp-3 font-medium text-foreground">{source.title}</span>
      </span>
    </span>
  );
}

// Every markdown link in an answer: citation links ("#cite-N", see
// lib/citations.ts) become source chips; other links open in a new tab, so
// following one never navigates away from (and kills) a streaming answer.
export function MarkdownLink({
  href,
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  node: _node,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) {
  if (href?.startsWith(CITE_PREFIX)) {
    return <CitationChip n={Number(href.slice(CITE_PREFIX.length))} />;
  }
  const external = !!href && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

// The answer's sources as a numbered row of cards under it.
export function SourcesRow({ sources }: { sources: ActivitySource[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div className="mb-2 text-xs font-medium text-text-tertiary">Sources</div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {sources.map((s, i) => (
          <a
            key={`${s.url}-${i}`}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="press group/src flex w-48 shrink-0 flex-col gap-1.5 rounded-xl border border-border/70 bg-elevated/60 p-2.5 transition-[border-color,background-color] duration-fast hover:border-border-strong hover:bg-elevated"
          >
            <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface px-1 text-[10px] font-semibold text-text-secondary">
                {i + 1}
              </span>
              <Favicon url={s.url} className="h-3.5 w-3.5" />
              <span className="truncate">{hostOf(s.url)}</span>
              <ArrowUpRight className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity duration-fast group-hover/src:opacity-100" />
            </span>
            <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
              {s.title}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// Suggested next questions under the latest answer; one tap sends it.
export function FollowupChips({
  followups,
  onPick,
}: {
  followups: string[];
  onPick: (text: string) => void;
}) {
  if (!followups.length) return null;
  return (
    <div className="mt-4 flex flex-col items-start gap-1.5">
      {followups.map((f, i) => (
        <button
          key={f}
          type="button"
          onClick={() => onPick(f)}
          style={{ animationDelay: `${i * 70}ms` }}
          className={cn(
            "press group/fu inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-elevated/50 px-3 py-1.5 text-left text-sm text-text-secondary",
            "transition-[border-color,background-color,color] duration-fast hover:border-accent/50 hover:bg-accent-muted hover:text-foreground",
            "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300"
          )}
        >
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors duration-fast group-hover/fu:text-accent" />
          <span className="truncate">{f}</span>
        </button>
      ))}
    </div>
  );
}
