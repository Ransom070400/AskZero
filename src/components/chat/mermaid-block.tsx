"use client";

import { useEffect, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

let counter = 0;

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++counter}`;

    loadMermaid()
      .then(async (mermaid) => {
        try {
          const { svg } = await mermaid.render(id, code);
          if (!cancelled && ref.current) {
            ref.current.innerHTML = svg;
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Render failed");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 overflow-hidden rounded-xl border border-warning/30 bg-warning/5">
        <div className="border-b border-warning/30 bg-warning/10 px-3 py-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-warning">
            mermaid · render failed
          </span>
        </div>
        <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-text-secondary">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-surface">
      <div className="flex items-center justify-between border-b border-border/60 bg-elevated/40 px-3 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          mermaid
        </span>
      </div>
      <div ref={ref} className="flex justify-center overflow-x-auto p-4" />
    </div>
  );
}
