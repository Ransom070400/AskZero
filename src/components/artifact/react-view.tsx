"use client";

import { useEffect, useState } from "react";

let sucrasePromise: Promise<typeof import("sucrase")> | null = null;

function loadSucrase() {
  if (!sucrasePromise) sucrasePromise = import("sucrase");
  return sucrasePromise;
}

export function ReactView({ code }: { code: string }) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrcDoc(null);
    setTransformError(null);

    loadSucrase()
      .then(({ transform }) => {
        const transformed = transform(code, {
          transforms: ["typescript", "jsx"],
          jsxRuntime: "classic",
          production: true,
        }).code;

        // The script tag is the module — we can't `export` from it and
        // also consume that export inside the same module. Rewrite default
        // exports into an assignment we can pick up after evaluation.
        const rewritten = transformed
          .replace(/export\s+default\s+function\s+(\w+)/g, "function $1; __exports.default = $1")
          .replace(/export\s+default\s+class\s+(\w+)/g, "class $1; __exports.default = $1")
          .replace(/export\s+default\s+/g, "__exports.default = ")
          .replace(/^export\s+/gm, "");

        const html = buildIframeHtml(rewritten);
        if (!cancelled) setSrcDoc(html);
      })
      .catch((err) => {
        if (!cancelled) {
          setTransformError(
            err instanceof Error ? err.message : "Transform failed"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (transformError) {
    return (
      <div className="m-4 rounded-xl border border-error/30 bg-error/5 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-error">
          Transform error
        </p>
        <pre className="mt-2 overflow-x-auto text-[12px] leading-relaxed text-text-secondary">
          {transformError}
        </pre>
      </div>
    );
  }

  if (!srcDoc) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-tertiary">
        Compiling...
      </div>
    );
  }

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="React preview"
    />
  );
}

function buildIframeHtml(transformedCode: string): string {
  const escaped = transformedCode.replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #111; background: #fff; }
  #__error {
    display: none;
    margin: 16px;
    padding: 12px 16px;
    border: 1px solid #fca5a5;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 8px;
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }
</style>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
  }
}
</script>
</head>
<body>
<div id="root"></div>
<pre id="__error"></pre>
<script type="module">
import React from "react";
import { createRoot } from "react-dom/client";

const __exports = {};

function showError(msg) {
  const el = document.getElementById("__error");
  el.textContent = msg;
  el.style.display = "block";
}

window.addEventListener("error", (e) => showError(e.message));
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason)));

try {
${escaped}

  // Fall back: any locally-declared function whose name starts with a capital letter.
  if (typeof __exports.default !== "function") {
    const guess = (() => {
      try {
        return App;
      } catch { return undefined; }
    })();
    if (typeof guess === "function") __exports.default = guess;
  }

  if (typeof __exports.default === "function") {
    createRoot(document.getElementById("root")).render(
      React.createElement(__exports.default)
    );
  } else {
    showError("No component found. Add 'export default ComponentName' or name your component App.");
  }
} catch (e) {
  showError(String(e && e.stack || e));
}
</script>
</body>
</html>`;
}
