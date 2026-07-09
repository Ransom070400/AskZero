// Autonomous build orchestrator — the "Code" counterpart to lib/research.ts.
//
//   plan (decompose into files) → write each file → review (find real bugs) →
//   fix → summarize → assemble a runnable deliverable.
//
// Emits progress events so the UI can show a live timeline. Every heavy step is
// a non-streaming GLM call (lib/llm); files are written/fixed concurrently. The
// final answer is assembled deterministically from the files (no model call can
// truncate the code), and the primary runnable file is surfaced for live preview.

import { complete, extractJson } from "./llm";

export type BuildDepth = "quick" | "standard";

interface Tier {
  maxFiles: number;
}

export const TIERS: Record<BuildDepth, Tier> = {
  quick: { maxFiles: 1 },
  standard: { maxFiles: 6 },
};

export const BUILD_COST: Record<BuildDepth, number> = {
  quick: 60,
  standard: 240,
};

export type BuildPhase =
  | "planning"
  | "writing"
  | "reviewing"
  | "finalizing"
  | "done"
  | "error";

export interface BuildFile {
  path: string;
  language: string;
  content: string;
}

export interface BuildPreview {
  type: "html" | "svg" | "react";
  language: string;
  content: string;
  title: string;
}

export interface BuildEvent {
  phase: BuildPhase;
  message?: string;
  approach?: string;
  plannedFiles?: { path: string; purpose: string }[];
  written?: number;
  total?: number;
  fileName?: string;
  issues?: string[];
  answer?: string;
  files?: BuildFile[];
  preview?: BuildPreview | null;
  error?: string;
}

interface PlannedFile {
  path: string;
  purpose: string;
}

interface Plan {
  approach: string;
  language: string;
  files: PlannedFile[];
}

const CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return out;
}

// Map a file path to a markdown fence language tag.
function langForPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    svg: "svg",
    tsx: "tsx",
    jsx: "jsx",
    ts: "ts",
    js: "js",
    mjs: "js",
    css: "css",
    scss: "scss",
    json: "json",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    sql: "sql",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
  };
  return map[ext] ?? "";
}

const REACT_HINTS =
  /\b(import\s+React|from\s+["']react["']|export\s+default\s+function|<[A-Z]\w+)/;

// Pick the single file that can be shown as a live preview (if any).
function pickPreview(files: BuildFile[]): BuildPreview | null {
  const html = files.find((f) => f.language === "html");
  if (html)
    return { type: "html", language: "html", content: html.content, title: html.path };

  const svg = files.find((f) => f.language === "svg" || f.content.trim().startsWith("<svg"));
  if (svg)
    return { type: "svg", language: "svg", content: svg.content, title: svg.path };

  const react = files.find(
    (f) => (f.language === "tsx" || f.language === "jsx") && REACT_HINTS.test(f.content)
  );
  if (react)
    return { type: "react", language: react.language, content: react.content, title: react.path };

  return null;
}

// Models sometimes wrap a single file in a code fence despite being told not to.
// Strip a leading/trailing fence so raw file contents stay raw.
function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return (m ? m[1] : t).trim();
}

export async function runBuild(
  task: string,
  depth: BuildDepth,
  emit: (e: BuildEvent) => void,
  langHint?: string
): Promise<{ answer: string; files: BuildFile[]; preview: BuildPreview | null } | null> {
  const tier = TIERS[depth];
  const hint = langHint?.trim() ? `\nPreferred language/framework: ${langHint.trim()}` : "";

  // 1) Plan — decompose into an approach and a minimal set of files.
  emit({ phase: "planning", message: "Designing the approach and file layout" });
  const planRaw = await complete(
    `Plan a small software build for the TASK below. Return ONLY JSON of the form ` +
      `{"approach":"<2-3 sentence approach>","language":"<primary language or framework>","files":[{"path":"index.html","purpose":"..."}]}.\n` +
      `Rules:\n` +
      `- Produce at most ${tier.maxFiles} file(s). Prefer the fewest files that work; a single self-contained file is ideal when the task is small.\n` +
      `- If the task is a web UI, app, component, game, or visualization, prefer ONE self-contained runnable HTML file with inline CSS and JS, so it can be previewed live.\n` +
      `- Choose real, conventional file paths/extensions.\n\n` +
      `TASK: ${task}${hint}`,
    { system: "You are a senior software architect. Plan minimal, correct, runnable code.", temperature: 0.3 }
  );

  const plan = extractJson<Plan>(planRaw);
  const language = (plan?.language ?? langHint ?? "").toString().trim() || "code";
  let planned: PlannedFile[] = Array.isArray(plan?.files)
    ? plan!.files
        .filter((f) => f && typeof f.path === "string" && f.path.trim())
        .map((f) => ({ path: f.path.trim(), purpose: String(f.purpose ?? "").trim() }))
        .slice(0, tier.maxFiles)
    : [];
  if (planned.length === 0) {
    // Fallback: a single sensibly-named file.
    planned = [{ path: "solution.txt", purpose: "The complete solution to the task." }];
  }
  const approach = (plan?.approach ?? "").toString().trim();
  emit({ phase: "planning", approach, plannedFiles: planned });

  // 2) Write — generate each file's full contents concurrently.
  emit({ phase: "writing", written: 0, total: planned.length });
  const others = planned.map((f) => `- ${f.path}: ${f.purpose}`).join("\n");
  let wrote = 0;
  const written: BuildFile[] = await mapLimit(planned, CONCURRENCY, async (f) => {
    const raw = await complete(
      `Write the COMPLETE contents of the file "${f.path}". Output ONLY the raw file contents — no markdown fences, no commentary, no explanation.\n\n` +
        `TASK: ${task}\n` +
        (approach ? `APPROACH: ${approach}\n` : "") +
        `THIS FILE'S PURPOSE: ${f.purpose}\n` +
        (planned.length > 1 ? `ALL FILES IN THE PROJECT (keep them consistent):\n${others}\n` : ""),
      {
        system: `You are an expert ${language} engineer. Write clean, correct, complete, runnable code. Never leave TODOs or placeholders.`,
        temperature: 0.2,
        maxTokens: 3200,
      }
    ).catch(() => "");
    wrote++;
    emit({ phase: "writing", written: wrote, total: planned.length, fileName: f.path });
    return { path: f.path, language: langForPath(f.path), content: stripFence(raw) };
  });

  const nonEmpty = written.filter((f) => f.content.trim());
  if (nonEmpty.length === 0) {
    emit({ phase: "error", error: "The model returned no code for this task." });
    return null;
  }

  // 3) Review — find real bugs / missing pieces across all files.
  emit({ phase: "reviewing", message: "Reviewing the code for bugs and gaps" });
  const filesBlock = nonEmpty
    .map((f) => `FILE: ${f.path}\n\`\`\`${f.language}\n${f.content.slice(0, 6000)}\n\`\`\``)
    .join("\n\n");
  const reviewRaw = await complete(
    `Review the code below for correctness bugs, missing pieces, and things that would stop it running. Be concrete. ` +
      `Return ONLY a JSON array of short issue strings (max 6). Return [] if the code is already correct and complete.\n\n` +
      `TASK: ${task}\n\n${filesBlock}`,
    { system: "You are a meticulous code reviewer. Report real defects, not style nits.", temperature: 0.2 }
  ).catch(() => "[]");
  const issues = (extractJson<string[]>(reviewRaw) ?? [])
    .filter((s) => typeof s === "string" && s.trim())
    .slice(0, 6);
  emit({ phase: "reviewing", issues });

  // 4) Fix — if the review found issues, revise each file applying them.
  let finalFiles = nonEmpty;
  if (issues.length > 0) {
    const issueList = issues.map((s) => `- ${s}`).join("\n");
    finalFiles = await mapLimit(nonEmpty, CONCURRENCY, async (f) => {
      const raw = await complete(
        `Revise the file "${f.path}" to fix the review issues that apply to it. Output ONLY the corrected, complete raw file contents — no fences, no commentary.\n\n` +
          `REVIEW ISSUES:\n${issueList}\n\n` +
          `CURRENT ${f.path}:\n${f.content}`,
        {
          system: `You are an expert ${language} engineer fixing code. Keep everything that already works; change only what the issues require.`,
          temperature: 0.2,
          maxTokens: 3200,
        }
      ).catch(() => "");
      const fixed = stripFence(raw);
      return fixed.trim() ? { ...f, content: fixed } : f;
    });
  }

  // 5) Summarize — a short human-facing intro + how-to-run (prose only, no code).
  emit({ phase: "finalizing", message: "Writing up the result" });
  const summary = (
    await complete(
      `In 2-4 sentences of plain markdown (no code blocks), explain what this build does and how to run it. Be concrete and brief.\n\n` +
        `TASK: ${task}\nAPPROACH: ${approach}\nFILES: ${finalFiles.map((f) => f.path).join(", ")}`,
      { system: "You write crisp, useful build notes.", temperature: 0.4, maxTokens: 400 }
    ).catch(() => "")
  ).trim();

  // 6) Assemble the final markdown deterministically from the files.
  const preview = pickPreview(finalFiles);
  const body = finalFiles
    .map((f) => `### \`${f.path}\`\n\n\`\`\`${f.language}\n${f.content.trim()}\n\`\`\``)
    .join("\n\n");
  const answer = [summary, body].filter(Boolean).join("\n\n");

  emit({ phase: "done", answer, files: finalFiles, preview });
  return { answer, files: finalFiles, preview };
}
