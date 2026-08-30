"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Code2, Loader2, Copy, Check, Play, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactRenderer } from "@/components/artifact/artifact-renderer";
import type { Artifact } from "@/components/artifact/types";
import { toast } from "@/lib/toast";

type Depth = "quick" | "standard";

interface Preview {
  type: "html" | "svg" | "react";
  language: string;
  content: string;
  title: string;
}

interface Progress {
  phase: string;
  message?: string;
  approach?: string;
  plannedFiles?: { path: string; purpose: string }[];
  written?: number;
  total?: number;
  fileName?: string;
  issues?: string[];
}

const COST: Record<Depth, number> = { quick: 60, standard: 240 };

export default function CodePage() {
  const [task, setTask] = useState("");
  const [language, setLanguage] = useState("");
  const [depth, setDepth] = useState<Depth>("quick");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [answer, setAnswer] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latest = progress[progress.length - 1];
  const planned = progress.find((p) => p.plannedFiles)?.plannedFiles;
  const issues = progress.find((p) => p.issues)?.issues;

  const run = async () => {
    const t = task.trim();
    if (!t || running) return;
    setRunning(true);
    setProgress([]);
    setAnswer("");
    setPreview(null);
    setView("preview");
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, depth, language: language.trim() || undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Build failed (${res.status})`);
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
          const raw = line.trim();
          if (!raw.startsWith("data:")) continue;
          const data = raw.slice(5).trim();
          if (data === "[DONE]" || !data) continue;
          const e = JSON.parse(data);
          if (e.phase === "error") {
            setError(e.error || "Build failed");
          } else if (e.phase === "done") {
            setAnswer(e.answer || "");
            setPreview(e.preview || null);
            setView(e.preview ? "preview" : "code");
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

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const previewArtifact: Artifact | null = preview
    ? {
        id: "preview",
        message_id: "preview",
        chat_id: "preview",
        type: preview.type,
        title: preview.title,
        language: preview.language,
        content: preview.content,
        version: 1,
        parent_artifact_id: null,
        created_at: "",
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 md:px-6 py-8 md:py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.025em] flex items-center gap-2">
          <Code2 className="h-6 w-6 text-accent" />
          Code
        </h1>
        <p className="text-[15px] text-text-secondary">
          Describe what to build — AskZero plans it, writes the code, reviews its own
          work for bugs, and hands you a runnable result with a live preview.
        </p>
      </div>

      {/* Task */}
      <div className="space-y-3 rounded-2xl border border-border/70 bg-elevated/60 p-4">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. A single-page pomodoro timer with start/pause/reset and a circular progress ring"
          rows={3}
          disabled={running}
          className="w-full resize-none bg-transparent text-[15px] text-foreground placeholder:text-text-tertiary outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
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
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Language (optional)"
              disabled={running}
              className="w-40 rounded-xl bg-surface px-3 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none"
            />
          </div>
          <Button onClick={run} disabled={running || !task.trim()} size="sm">
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Code2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? "Building…" : "Build"}
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
          <ProgressLine
            active
            done={progress.some((p) => p.phase !== "planning")}
            label="Planning the build"
          >
            {planned ? planned.map((f) => f.path).join(" · ") : latest?.approach}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "writing")}
            done={progress.some((p) => ["reviewing", "finalizing"].includes(p.phase))}
            label="Writing the code"
          >
            {latest?.phase === "writing" && latest.total
              ? `${latest.written}/${latest.total} — ${latest.fileName ?? ""}`
              : null}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "reviewing")}
            done={progress.some((p) => p.phase === "finalizing")}
            label="Reviewing for bugs"
          >
            {issues
              ? issues.length === 0
                ? "No issues found"
                : `${issues.length} issue${issues.length === 1 ? "" : "s"} to fix`
              : null}
          </ProgressLine>
          <ProgressLine
            active={progress.some((p) => p.phase === "finalizing")}
            done={false}
            label="Finalizing"
          />
        </div>
      )}

      {/* Live preview */}
      {previewArtifact && (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-elevated/40">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
              <FileCode2 className="h-3.5 w-3.5" />
              <span className="truncate">{previewArtifact.title}</span>
            </div>
            <div className="inline-flex items-center rounded-lg bg-surface p-0.5">
              {(["preview", "code"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                    view === v
                      ? "bg-elevated text-foreground shadow-sm"
                      : "text-text-tertiary hover:text-foreground"
                  }`}
                >
                  {v === "preview" ? (
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3" /> Preview
                    </span>
                  ) : (
                    "Code"
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[440px] overflow-auto overscroll-contain bg-white dark:bg-surface">
            <ArtifactRenderer artifact={previewArtifact} view={view} />
          </div>
        </div>
      )}

      {/* Deliverable */}
      {answer && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Deliverable
            </h2>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] text-text-tertiary hover:bg-elevated hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          <article
            className="prose prose-sm dark:prose-invert max-w-none rounded-2xl border border-border/70 bg-elevated/40 p-5 text-[14px] leading-relaxed
              [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:border [&_pre]:border-border/70 [&_pre]:p-4 [&_pre]:overflow-x-auto"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {answer}
            </ReactMarkdown>
          </article>
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
