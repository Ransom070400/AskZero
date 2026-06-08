"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "@/components/chat/mermaid-block";
import { ReactView } from "./react-view";
import type { Artifact } from "./types";

export function ArtifactRenderer({
  artifact,
  view,
}: {
  artifact: Artifact;
  view: "preview" | "code";
}) {
  if (view === "code" || artifact.type === "code") {
    return <CodeView content={artifact.content} language={artifact.language} />;
  }

  switch (artifact.type) {
    case "html":
      return <HtmlView content={artifact.content} />;
    case "svg":
      return <SvgView content={artifact.content} />;
    case "mermaid":
      return (
        <div className="p-4">
          <MermaidBlock code={artifact.content} />
        </div>
      );
    case "markdown":
      return <MarkdownView content={artifact.content} />;
    case "react":
      return <ReactView code={artifact.content} />;
    default:
      return <CodeView content={artifact.content} language={artifact.language} />;
  }
}

function CodeView({
  content,
  language,
}: {
  content: string;
  language: string | null;
}) {
  const md = `\`\`\`${language ?? ""}\n${content}\n\`\`\``;
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none p-4 text-[13px]
        [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:border [&_pre]:border-border/70 [&_pre]:p-4 [&_pre]:leading-relaxed [&_pre]:overflow-x-auto
        [&_code]:font-normal"
    >
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
        {md}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownView({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none p-6 text-[14px] leading-[1.7]
        [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display"
    >
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function HtmlView({ content }: { content: string }) {
  return (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="HTML preview"
    />
  );
}

function SvgView({ content }: { content: string }) {
  const trimmed = content.trim();
  const html = trimmed.startsWith("<svg")
    ? `<!doctype html><html><head><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff;}svg{max-width:100%;max-height:100%;}</style></head><body>${trimmed}</body></html>`
    : trimmed;
  return (
    <iframe
      srcDoc={html}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="SVG preview"
    />
  );
}
