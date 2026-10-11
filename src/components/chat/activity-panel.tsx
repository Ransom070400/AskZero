"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Calculator, Check, ChevronDown, Globe, Lightbulb, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivitySource {
  title: string;
  url: string;
}

// One step of the agent's work, as streamed by /api/chat. `at` is stamped on
// the client when the step arrives, so the timeline can show durations.
export interface AgentStep {
  type: "thinking" | "tool" | "tool_result";
  text?: string;
  tool?: string;
  input?: string;
  sources?: ActivitySource[];
  at?: number;
}

interface ToolRow {
  kind: "tool";
  tool?: string;
  input?: string;
  done: boolean;
  ms?: number;
  sources?: ActivitySource[];
}
interface NoteRow {
  kind: "note";
  text: string;
}
type Row = ToolRow | NoteRow;

// Pair each tool call with its result: one row per call, done once the
// result is in (or anything after it has arrived).
function buildRows(steps: AgentStep[]): Row[] {
  const rows: Row[] = [];
  steps.forEach((s, i) => {
    if (s.type === "thinking" && s.text) rows.push({ kind: "note", text: s.text });
    if (s.type !== "tool") return;
    const result = steps
      .slice(i + 1)
      .find((r) => r.type === "tool_result" && r.tool === s.tool);
    const done = !!result || i < steps.length - 1;
    rows.push({
      kind: "tool",
      tool: s.tool,
      input: s.input,
      done,
      ms: result?.at && s.at ? result.at - s.at : undefined,
      sources: result?.sources,
    });
  });
  return rows;
}

const TOOL_LABEL: Record<string, [active: string, done: string]> = {
  web_search: ["Searching the web", "Searched the web"],
  calculate: ["Calculating", "Calculated"],
  fetch_url: ["Reading the page", "Read the page"],
};

function ToolIcon({ tool, className }: { tool?: string; className?: string }) {
  const Icon = tool === "calculate" ? Calculator : tool === "fetch_url" ? Globe : Search;
  return <Icon className={className} />;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Favicon({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);
  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-surface text-[9px] font-semibold uppercase text-text-tertiary",
          className
        )}
      >
        {host[0]}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded-full bg-surface object-contain", className)}
    />
  );
}

function seconds(ms?: number): string | null {
  if (ms == null) return null;
  return ms < 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

// One-line summary of finished work: "Searched the web · 5 sources · 8s".
function summarize(rows: Row[], hasReasoning: boolean, totalMs?: number): string {
  const tools = rows.filter((r): r is ToolRow => r.kind === "tool");
  const parts: string[] = [];
  const searches = tools.filter((t) => t.tool === "web_search").length;
  const sources = tools.reduce((n, t) => n + (t.sources?.length ?? 0), 0);
  const reads = tools.filter((t) => t.tool === "fetch_url").length;
  const calcs = tools.filter((t) => t.tool === "calculate").length;
  if (searches) parts.push(searches === 1 ? "Searched the web" : `Ran ${searches} searches`);
  if (sources) parts.push(`${sources} source${sources === 1 ? "" : "s"}`);
  if (reads) parts.push(reads === 1 ? "Read a page" : `Read ${reads} pages`);
  if (calcs) parts.push("Calculated");
  if (!parts.length) parts.push(hasReasoning ? "Thought it through" : "Worked on it");
  const total = seconds(totalMs);
  if (total) parts.push(total);
  return parts.join(" · ");
}

// The answer's "how I got here": the agent's notes, each tool call with its
// status, sources and timing, and the model's own reasoning — one timeline.
// Live while the model works; collapses to a one-line summary (expandable)
// once the answer starts.
export function ActivityPanel({
  steps,
  reasoning,
  active,
  startedAt,
  endedAt,
}: {
  steps: AgentStep[];
  reasoning?: string;
  active: boolean;
  startedAt?: number;
  endedAt?: number;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reasoningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  // Keep the newest reasoning in view while it streams.
  useEffect(() => {
    if (active && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoning, active]);

  const rows = buildRows(steps);
  const elapsed = startedAt ? (active ? now : endedAt ?? now) - startedAt : undefined;
  if (!rows.length && !reasoning) return null;

  const timeline = (live: boolean) => (
    <ol className="relative mt-2 space-y-2.5 border-l border-border pl-4">
      {rows.map((row, i) =>
        row.kind === "note" ? (
          <li key={i} className="relative text-sm italic leading-snug text-text-tertiary animate-in fade-in-0 slide-in-from-left-1 duration-300">
            <span className="absolute -left-[21px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-background">
              <Lightbulb className="h-2.5 w-2.5 text-text-tertiary" />
            </span>
            {row.text}
          </li>
        ) : (
          <li key={i} className="relative animate-in fade-in-0 slide-in-from-left-1 duration-300">
            <span
              className={cn(
                "absolute -left-[21.5px] top-1 flex h-3 w-3 items-center justify-center rounded-full border bg-background",
                row.done ? "border-accent/60" : "border-accent"
              )}
            >
              {row.done ? (
                <Check className="h-2 w-2 text-accent" strokeWidth={3} />
              ) : (
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent" />
              )}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <ToolIcon tool={row.tool} className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className={row.done ? "text-text-secondary" : "shimmer-text font-medium"}>
                {(TOOL_LABEL[row.tool ?? ""] ?? ["Working", "Done"])[row.done ? 1 : 0]}
              </span>
              {row.input && (
                <span className="max-w-[28ch] truncate rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                  {row.input}
                </span>
              )}
              {row.ms != null && (
                <span className="tabular-nums text-xs text-text-tertiary">{seconds(row.ms)}</span>
              )}
            </div>
            {row.sources && row.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.sources.slice(0, live ? 5 : 8).map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.title}
                    className="press inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border/70 bg-elevated/60 px-2 py-0.5 text-xs text-text-secondary transition-colors duration-fast hover:border-border-strong hover:text-foreground animate-in fade-in-0 zoom-in-95"
                  >
                    <Favicon url={s.url} className="h-3.5 w-3.5" />
                    <span className="truncate">{hostOf(s.url)}</span>
                  </a>
                ))}
              </div>
            )}
          </li>
        )
      )}
      {reasoning && (
        <li className="relative">
          <span className="absolute -left-[21px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-background">
            <Brain className="h-2.5 w-2.5 text-accent" />
          </span>
          <div className="text-sm">
            <span className={live ? "shimmer-text font-medium" : "text-text-secondary"}>
              Reasoning
            </span>
          </div>
          <div
            ref={live ? reasoningRef : undefined}
            className={cn(
              "mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-tertiary",
              live
                ? "max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
                : "max-h-80 overflow-y-auto"
            )}
          >
            {reasoning}
          </div>
        </li>
      )}
    </ol>
  );

  if (active) {
    return (
      <div className="mb-3" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
            <span className="h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="shimmer-text font-medium">Working</span>
          {elapsed != null && (
            <span className="tabular-nums text-text-tertiary">{seconds(Math.max(elapsed, 0))}</span>
          )}
        </div>
        {timeline(true)}
      </div>
    );
  }

  const sources = rows.flatMap((r) => (r.kind === "tool" ? r.sources ?? [] : []));
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press -ml-2 inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-sm text-text-tertiary transition-colors duration-fast hover:bg-surface hover:text-foreground"
      >
        {sources.length > 0 ? (
          <span className="flex -space-x-1.5">
            {sources.slice(0, 3).map((s) => (
              <Favicon key={s.url} url={s.url} className="h-4 w-4 ring-2 ring-background" />
            ))}
          </span>
        ) : (
          <Brain className="h-3.5 w-3.5" />
        )}
        <span className="truncate">{summarize(rows, !!reasoning, elapsed)}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-fast", open && "rotate-180")}
        />
      </button>
      {open && <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200">{timeline(false)}</div>}
    </div>
  );
}

