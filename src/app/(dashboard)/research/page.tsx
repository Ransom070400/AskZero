"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Depth = "quick" | "standard";

interface Source {
  n: number;
  title: string;
  url: string;
}

interface Progress {
  phase: string;
  message?: string;
  queries?: string[];
  sourcesFound?: number;
  read?: number;
  total?: number;
  sourceTitle?: string;
}

const COST: Record<Depth, number> = { quick: 50, standard: 200 };

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<Depth>("quick");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latest = progress[progress.length - 1];

  const run = async () => {
    const q = query.trim();
    if (!q || running) return;
    setRunning(true);
    setProgress([]);
    setReport("");
    setSources([]);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, depth }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Research failed (${res.status})`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]" || !data) continue;
          const e = JSON.parse(data);
          if (e.phase === "error") {
            setError(e.error || "Research failed");
          } else if (e.phase === "done") {
            setReport(e.report || "");
            setSources(e.sources || []);
          } else if (e.phase !== "settled") {
            setProgress((p) => [...p, e]);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 md:px-6 py-8 md:py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.025em] flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" />
          Research
        </h1>
        <p className="text-[15px] text-text-secondary">
          Ask a question — AskZero searches the web, reads the sources, cross-checks
          them, and writes a cited report with confidence.
        </p>
      </div>

      {/* Query */}
      <div className="space-y-3 rounded-2xl border border-border/70 bg-elevated/60 p-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. What are the tradeoffs between 0G, Filecoin, and Arweave for storage?"
          rows={3}
          disabled={running}
          className="w-full resize-none bg-transparent text-[15px] text-foreground placeholder:text-text-tertiary outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-xl bg-surface p-0.5">
            {(["quick", "standard"] as Depth[]).map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                disabled={running}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
                  depth === d
                    ? "bg-elevated text-foreground shadow-sm"
                    : "text-text-tertiary hover:text-foreground"
                }`}
              >
                {d} · {COST[d]}c
              </button>
            ))}
          </div>
          <Button onClick={run} disabled={running || !query.trim()} size="sm">
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? "Researching…" : "Research"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {error}
        </div>
      )}

      {/* Live progress */}
      {running && (
        <div className="rounded-2xl border border-border/70 bg-elevated/40 p-4 space-y-2">
          <ProgressLine active label="Planning" done={progress.some((p) => p.phase !== "planning")}>
            {progress.find((p) => p.queries)?.queries?.join(" · ")}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "searching")}
            done={progress.some((p) => ["reading", "synthesizing"].includes(p.phase))}
            label="Searching the web"
          >
            {progress.find((p) => p.sourcesFound != null)?.sourcesFound != null
              ? `${progress.find((p) => p.sourcesFound != null)!.sourcesFound} sources`
              : null}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "reading")}
            done={progress.some((p) => p.phase === "synthesizing")}
            label="Reading sources"
          >
            {latest?.phase === "reading" && latest.total
              ? `${latest.read}/${latest.total} — ${latest.sourceTitle ?? ""}`
              : null}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "synthesizing")}
            done={false}
            label="Cross-checking & writing"
          />
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-4">
          <article className="prose prose-invert max-w-none rounded-2xl border border-border/70 bg-elevated/40 p-5 text-[15px] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </article>
          {sources.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-elevated/40 p-4">
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Sources
              </h2>
              <ol className="space-y-1.5">
                {sources.map((s) => (
                  <li key={s.n} className="flex items-baseline gap-2 text-[13px]">
                    <span className="text-text-tertiary tabular-nums">[{s.n}]</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline inline-flex items-center gap-1 truncate"
                    >
                      {s.title || s.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressLine({
  active,
  done,
  label,
  children,
}: {
  active: boolean;
  done: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">
        {done ? (
          <div className="h-3.5 w-3.5 rounded-full bg-success" />
        ) : active ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : (
          <div className="h-3.5 w-3.5 rounded-full border border-border" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-[13px] font-medium ${active || done ? "text-foreground" : "text-text-tertiary"}`}>
          {label}
        </p>
        {children ? (
          <p className="text-[12px] text-text-tertiary leading-relaxed truncate">{children}</p>
        ) : null}
      </div>
    </div>
  );
}
