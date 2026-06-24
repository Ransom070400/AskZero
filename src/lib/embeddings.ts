// Text embeddings via the 0G Integrate Network's OpenAI-compatible
// /embeddings endpoint (the sibling of /chat/completions and
// /audio/transcriptions used elsewhere).
//
// Powers semantic recall in the memory layer. Everything degrades
// gracefully: if no embedding model is configured or the call fails,
// embed() returns null and recall falls back to recency (handled in
// match_memories).

// Must match the vector(N) dimension in the memory_layer migration.
export const EMBEDDING_DIM = 1536;

function embBaseUrl(): string | undefined {
  return process.env.EMBEDDING_URL ?? process.env.INTEGRATE_NETWORK_URL;
}

function embApiKey(): string | undefined {
  return process.env.EMBEDDING_KEY ?? process.env.INTEGRATE_NETWORK_KEY;
}

function embModel(): string {
  return process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(embBaseUrl() && embApiKey());
}

// Embed a single string. Returns a fixed-length float vector, or null if
// embeddings aren't available (caller must handle null).
export async function embed(text: string): Promise<number[] | null> {
  const baseUrl = embBaseUrl();
  const apiKey = embApiKey();
  if (!baseUrl || !apiKey) return null;

  const input = text.slice(0, 8000); // keep well under typical token limits

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: embModel(), input }),
    });

    if (!res.ok) {
      console.error(
        `Embedding error (${res.status}):`,
        (await res.text()).slice(0, 300)
      );
      return null;
    }

    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    return vec as number[];
  } catch (err) {
    console.error("Embedding request threw:", err);
    return null;
  }
}

// pgvector accepts a string literal like "[0.1,0.2,...]". Returns null for a
// null/empty vector so callers can pass SQL NULL straight through.
export function toVectorLiteral(vec: number[] | null): string | null {
  if (!vec || vec.length === 0) return null;
  return `[${vec.join(",")}]`;
}
