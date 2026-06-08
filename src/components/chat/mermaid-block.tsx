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
  // null = rendered ok; "invalid" = couldn't parse (e.g. still streaming or
  // genuinely malformed) — we fall back to showing the raw code quietly.
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++counter}`;

    loadMermaid()
      .then(async (mermaid) => {
        // Validate BEFORE rendering. parse() with suppressErrors returns false
        // on invalid/incomplete input instead of throwing — and, crucially,
        // without injecting Mermaid's "Syntax error in text — mermaid version
        // X" graphic into the document, which render() does even when the
        // thrown error is caught. That orphaned graphic was leaking onto the
        // page while a ```mermaid block was still streaming in.
        let valid = false;
        try {
          valid = Boolean(await mermaid.parse(code, { suppressErrors: true }));
        } catch {
          valid = false;
        }

        if (cancelled) return;
        if (!valid) {
          setInvalid(true);
          return;
        }

        try {
          const { svg } = await mermaid.render(id, code);
          // Belt-and-suspenders: if Mermaid ever returns its error-bomb SVG
          // instead of throwing, don't show it — fall back to the code block.
          const isErrorSvg =
            svg.includes('aria-roledescription="error"') ||
            svg.includes("Syntax error in text");
          if (!cancelled && ref.current && !isErrorSvg) {
            ref.current.innerHTML = svg;
            setInvalid(false);
          } else if (!cancelled && isErrorSvg) {
            setInvalid(true);
          }
        } catch {
          if (!cancelled) setInvalid(true);
        } finally {
          // Defensively remove any temp/error node Mermaid may have appended
          // to <body> for measurement so it can never linger on the page.
          if (typeof document !== "undefined") {
            document.getElementById(id)?.remove();
            document.getElementById(`d${id}`)?.remove();
          }
        }
      })
      .catch(() => {
        if (!cancelled) setInvalid(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  // Couldn't render (incomplete while streaming, or invalid syntax): show the
  // source as a plain code block rather than an alarming error — once enough
  // of the diagram has streamed in and it parses, this re-renders as the SVG.
  if (invalid) {
    return (
      <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-surface">
        <div className="flex items-center justify-between border-b border-border/60 bg-elevated/40 px-3 py-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            mermaid
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
