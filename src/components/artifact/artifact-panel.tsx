"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Code2, Copy, Download, Eye, X } from "lucide-react";
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
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-elevated/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            {artifact ? TYPE_BADGE[artifact.type] : "..."}
          </span>
          <h2 className="truncate text-[14px] font-semibold text-foreground">
            {artifact?.title ?? "Loading..."}
          </h2>
          {artifact && versions.length > 1 && (
            <div className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-elevated/40 px-0.5">
              <button
                onClick={() =>
                  canPrev && setActiveId(versions[versionIndex - 1].id)
                }
                disabled={!canPrev}
                aria-label="Previous version"
                className="press inline-flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-fast"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="px-1 text-[11px] font-medium text-text-tertiary tabular-nums">
                v{artifact.version}/{versions.length}
              </span>
              <button
                onClick={() =>
                  canNext && setActiveId(versions[versionIndex + 1].id)
                }
                disabled={!canNext}
                aria-label="Next version"
                className="press inline-flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-fast"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {artifact &&
            artifact.type !== "code" &&
            artifact.type !== "markdown" && (
              <div className="mr-1 inline-flex rounded-full border border-border/70 bg-elevated/60 p-0.5">
                <ViewTab
                  active={view === "preview"}
                  onClick={() => setView("preview")}
                  icon={<Eye className="h-3 w-3" />}
                  label="Preview"
                />
                <ViewTab
                  active={view === "code"}
                  onClick={() => setView("code")}
                  icon={<Code2 className="h-3 w-3" />}
                  label="Code"
                />
              </div>
            )}
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
          <IconBtn onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
      </header>

      <div className="flex-1 overflow-auto overscroll-contain">
        {error && (
          <div className="p-6 text-[13px] text-error">{error}</div>
        )}
        {!artifact && !error && (
          <div className="p-6 text-[13px] text-text-tertiary">Loading...</div>
        )}
        {artifact && <ArtifactRenderer artifact={artifact} view={view} />}
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-fast ease-out",
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
