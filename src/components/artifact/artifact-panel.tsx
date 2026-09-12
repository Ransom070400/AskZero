"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Eye,
  History,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactRenderer } from "./artifact-renderer";
import type { Artifact, ArtifactVersion } from "./types";

const TYPE_BADGE: Record<Artifact["type"], string> = {
  code: "Code",
  markdown: "Markdown",
  html: "HTML",
  svg: "SVG",
  mermaid: "Diagram",
  react: "React",
};

const EXTENSION: Record<Artifact["type"], string> = {
  code: "txt",
  markdown: "md",
  html: "html",
  svg: "svg",
  mermaid: "mmd",
  react: "tsx",
};

export function ArtifactPanel({
  artifactId,
  onClose,
}: {
  artifactId: string;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState(artifactId);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    setActiveId(artifactId);
  }, [artifactId]);

  useEffect(() => {
    let cancelled = false;
    setArtifact(null);
    setError(null);
    fetch(`/api/artifacts/${activeId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error((await res.json())?.error ?? "Failed to load");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setArtifact(data.artifact);
        setVersions(data.versions ?? []);
        setView(data.artifact.type === "code" ? "code" : "preview");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const versionIndex = artifact
    ? versions.findIndex((v) => v.id === artifact.id)
    : -1;
  const canPrev = versionIndex > 0;
  const canNext = versionIndex >= 0 && versionIndex < versions.length - 1;
  const canPreview =
    !!artifact && artifact.type !== "code" && artifact.type !== "markdown";
  const activeVersionLabel =
    artifact && versions.length > 1 ? `v${artifact.version}/${versions.length}` : null;

  const handleCopy = () => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const ext = artifact.language ?? EXTENSION[artifact.type];
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(artifact.title || "artifact").replace(/[^a-z0-9-_.]/gi, "_")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background",
        fullscreen && "fixed inset-0 z-[80]"
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 rounded-md bg-elevated/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              {artifact ? TYPE_BADGE[artifact.type] : "..."}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-semibold text-foreground">
                {artifact?.title ?? "Loading..."}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                <span>{artifact?.language ?? artifact?.type ?? "artifact"}</span>
                {activeVersionLabel && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-border-strong" />
                    <span className="tabular-nums">{activeVersionLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn onClick={handleCopy} aria-label={copied ? "Copied" : "Copy"}>
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </IconBtn>
            <IconBtn onClick={handleDownload} aria-label="Download">
              <Download className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </IconBtn>
            <IconBtn onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-elevated/60 p-0.5">
            <ViewTab
              active={view === "preview"}
              onClick={() => canPreview && setView("preview")}
              disabled={!canPreview}
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Preview"
            />
            <ViewTab
              active={view === "code"}
              onClick={() => setView("code")}
              icon={<Code2 className="h-3.5 w-3.5" />}
              label="Code"
            />
          </div>

          {artifact && versions.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => canPrev && setActiveId(versions[versionIndex - 1].id)}
                disabled={!canPrev}
                aria-label="Previous version"
                className="press inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-fast hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowVersions((v) => !v)}
                aria-pressed={showVersions}
                className={cn(
                  "press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors duration-fast",
                  showVersions
                    ? "bg-accent-muted text-accent"
                    : "text-text-tertiary hover:bg-surface hover:text-foreground"
                )}
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
              <button
                onClick={() => canNext && setActiveId(versions[versionIndex + 1].id)}
                disabled={!canNext}
                aria-label="Next version"
                className="press inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-fast hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showVersions && artifact && versions.length > 1 && (
          <aside className="hidden w-44 shrink-0 border-r border-border/70 bg-surface/40 p-2 md:block">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Versions
            </p>
            <div className="space-y-1">
              {versions.map((version) => {
                const active = version.id === artifact.id;
                const created = new Date(version.created_at);
                return (
                  <button
                    key={version.id}
                    onClick={() => setActiveId(version.id)}
                    className={cn(
                      "press flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors duration-fast",
                      active
                        ? "bg-accent-muted text-foreground"
                        : "text-text-secondary hover:bg-elevated hover:text-foreground"
                    )}
                  >
                    <span className="text-[12px] font-semibold">
                      Version {version.version}
                    </span>
                    <span className="mt-0.5 text-[10px] text-text-tertiary">
                      {created.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
        <div className="min-w-0 flex-1 overflow-auto overscroll-contain">
          {error && <div className="p-6 text-[13px] text-error">{error}</div>}
          {!artifact && !error && (
            <div className="p-6 text-[13px] text-text-tertiary">Loading...</div>
          )}
          {artifact && <ArtifactRenderer artifact={artifact} view={view} />}
        </div>
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-text-tertiary hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className="press inline-flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast"
    >
      {children}
    </button>
  );
}
