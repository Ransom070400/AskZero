// Autonomous research orchestrator. Reused by web + mobile via /api/research.
//
//   plan → search (Tavily) → read each source (extract claims) →
//   verify + synthesize a cited report with confidence.
//
// Emits progress events so the UI can show a live timeline. Every heavy step is
// a non-streaming GLM call (lib/llm); the final report is one strong call.

import { complete, extractJson } from "./llm";
import { tavilySearch, tavilyConfigured, type TavilyResult } from "./tavily";

export type ResearchDepth = "quick" | "standard";

interface Tier {
  queries: number;
  perQuery: number;
  maxSources: number;
}

export const TIERS: Record<ResearchDepth, Tier> = {
  quick: { queries: 3, perQuery: 4, maxSources: 8 },
  standard: { queries: 5, perQuery: 6, maxSources: 24 },
};

export const RESEARCH_COST: Record<ResearchDepth, number> = {
  quick: 50,
  standard: 200,
};

export type ResearchPhase =
  | "planning"
  | "searching"
  | "reading"
  | "synthesizing"
  | "done"
  | "error";

export interface ResearchSource {
  n: number;
  title: string;
  url: string;
}

export interface ResearchEvent {
  phase: ResearchPhase;
  message?: string;
  queries?: string[];
  sourcesFound?: number;
  read?: number;
  total?: number;
  sourceTitle?: string;
  report?: string;
  sources?: ResearchSource[];
  error?: string;
}

interface SourceNote extends ResearchSource {
  claims: string[];
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

export async function runResearch(
  query: string,
  depth: ResearchDepth,
  emit: (e: ResearchEvent) => void
): Promise<{ report: string; sources: ResearchSource[] } | null> {
  if (!tavilyConfigured()) {
    emit({ phase: "error", error: "Web search is not configured (TAVILY_API_KEY)." });
    return null;
  }
  const tier = TIERS[depth];

  // 1) Plan — decompose into focused search queries.
  emit({ phase: "planning", message: "Breaking the question into search angles" });
  const planRaw = await complete(
    `Break this research question into ${tier.queries} focused, non-overlapping web-search queries that together cover it comprehensively. Return ONLY a JSON array of strings.\n\nQuestion: ${query}`,
    { system: "You are a research planner.", temperature: 0.3 }
  );
  const queries = (extractJson<string[]>(planRaw) ?? [query])
    .filter((q) => typeof q === "string" && q.trim())
    .slice(0, tier.queries);
  emit({ phase: "planning", queries });

  // 2) Search — Tavily returns extracted content, no scraping needed.
  emit({ phase: "searching", message: "Searching the web" });
  const perQuery = await mapLimit(queries, CONCURRENCY, (q) =>
    tavilySearch(q, { maxResults: tier.perQuery }).catch(() => [] as TavilyResult[])
  );
  const seen = new Set<string>();
  const found: TavilyResult[] = [];
  for (const list of perQuery)
    for (const r of list)
      if (r.url && r.content && !seen.has(r.url)) {
        seen.add(r.url);
        found.push(r);
      }
  const capped = found.slice(0, tier.maxSources);
  emit({ phase: "searching", sourcesFound: capped.length });

  if (capped.length === 0) {
    emit({ phase: "error", error: "No sources found for this question." });
    return null;
  }

  // 3) Read each source — extract relevant factual claims.
  emit({ phase: "reading", read: 0, total: capped.length });
  let done = 0;
  const notes: SourceNote[] = await mapLimit(capped, CONCURRENCY, async (src, i) => {
    const raw = await complete(
      `From the source below, extract up to 4 factual claims relevant to the question "${query}". Return ONLY a JSON array of short strings; return [] if nothing relevant.\n\nSOURCE: ${src.title}\n${src.content.slice(0, 4000)}`,
      { system: "You extract factual claims from a source.", temperature: 0.2 }
    ).catch(() => "[]");
    done++;
    emit({ phase: "reading", read: done, total: capped.length, sourceTitle: src.title });
    return {
      n: i + 1,
      title: src.title,
      url: src.url,
      claims: (extractJson<string[]>(raw) ?? []).filter((c) => typeof c === "string"),
    };
  });

  // 4) Verify + synthesize — one rigorous, cited report.
  emit({ phase: "synthesizing", message: "Cross-checking sources and writing the report" });
  const sourcesBlock = notes
    .map(
      (s) =>
        `[${s.n}] ${s.title} (${s.url})\n${s.claims.map((c) => `- ${c}`).join("\n")}`
    )
    .join("\n\n");

  const report = await complete(
    `Write a well-structured research report answering the QUESTION using ONLY the source notes. Use inline citations like [1], [2] that reference the numbered sources. Reflect confidence based on how many independent sources support each major claim, and explicitly call out any contradictions or gaps. End with a "## Confidence" paragraph and a "## Sources" list (number — title — url).\n\nQUESTION: ${query}\n\nSOURCE NOTES:\n${sourcesBlock}`,
    {
      system:
        "You are a rigorous research analyst. State only what the sources support, cite everything, and flag uncertainty honestly.",
      temperature: 0.4,
      maxTokens: 2200,
    }
  );

  const sources: ResearchSource[] = notes.map(({ n, title, url }) => ({ n, title, url }));
  emit({ phase: "done", report, sources });
  return { report, sources };
}
