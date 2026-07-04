// Tavily web search — returns already-extracted page content, so the research
// pipeline never has to scrape/read HTML itself. Free tier is plenty for v1.
// https://docs.tavily.com

export interface TavilyResult {
  title: string;
  url: string;
  content: string; // extracted, relevance-ranked chunk
  score: number;
}

export function tavilyConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; depth?: "basic" | "advanced" } = {}
): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: opts.depth ?? "basic",
      max_results: opts.maxResults ?? 6,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return ((data.results ?? []) as Record<string, unknown>[]).map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    content: String(r.content ?? ""),
    score: Number(r.score ?? 0),
  }));
}
