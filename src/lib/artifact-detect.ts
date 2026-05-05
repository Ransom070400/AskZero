export type ArtifactType =
  | "code"
  | "markdown"
  | "html"
  | "svg"
  | "mermaid"
  | "react";

export interface DetectedArtifact {
  type: ArtifactType;
  title: string;
  language: string | null;
  content: string;
}

interface FencedBlock {
  lang: string;
  body: string;
}

const CODE_LINE_THRESHOLD = 30;
const MERMAID_LINE_THRESHOLD = 5;
const REACT_HINTS = /\b(import\s+React|from\s+["']react["']|export\s+default\s+function|<[A-Z]\w+)/;

export function detectArtifacts(content: string): DetectedArtifact[] {
  if (!content) return [];

  const blocks = parseFencedBlocks(content);
  const artifacts: DetectedArtifact[] = [];

  for (const block of blocks) {
    const lines = block.body.split("\n").length;
    const lang = block.lang.toLowerCase();

    if (lang === "mermaid" && lines >= MERMAID_LINE_THRESHOLD) {
      artifacts.push({
        type: "mermaid",
        title: "Diagram",
        language: null,
        content: block.body,
      });
      continue;
    }

    if (lang === "html" || /^<!doctype html/i.test(block.body.trim())) {
      artifacts.push({
        type: "html",
        title: extractHtmlTitle(block.body) ?? "HTML document",
        language: "html",
        content: block.body,
      });
      continue;
    }

    if (lang === "svg" || /^<svg[\s>]/i.test(block.body.trim())) {
      artifacts.push({
        type: "svg",
        title: "SVG graphic",
        language: "svg",
        content: block.body,
      });
      continue;
    }

    if ((lang === "jsx" || lang === "tsx" || lang === "react") && REACT_HINTS.test(block.body)) {
      artifacts.push({
        type: "react",
        title: "React component",
        language: lang === "react" ? "tsx" : lang,
        content: block.body,
      });
      continue;
    }

    if (lang && lines >= CODE_LINE_THRESHOLD && lang !== "markdown" && lang !== "md") {
      artifacts.push({
        type: "code",
        title: titleFromCode(block.body, lang),
        language: lang,
        content: block.body,
      });
      continue;
    }
  }

  return artifacts;
}

function parseFencedBlocks(content: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  // Match ``` optionally followed by a language tag, then everything up to
  // the closing ```. Use [^\n]* for the lang line so it tolerates "```ts {1,2}".
  const re = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const langTag = match[1].trim().split(/\s+/)[0] ?? "";
    blocks.push({ lang: langTag, body: match[2] });
  }
  return blocks;
}

function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || null;
}

function titleFromCode(body: string, lang: string): string {
  // Try to find a function/class/component name on the first non-empty line.
  const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  const nameMatch = firstLine.match(
    /(?:function|class|const|def|fn|let|var|export\s+default(?:\s+function)?)\s+([A-Za-z_]\w*)/
  );
  if (nameMatch) return nameMatch[1];
  return `${lang.toUpperCase()} snippet`;
}
