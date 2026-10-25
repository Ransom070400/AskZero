// PostgREST caps a single response at ~1000 rows (a .limit() above that is
// silently clamped), so platform-wide aggregates page through with range().
const PAGE = 1000;
const MAX_PAGES = 50; // safety cap: 50k rows

// Throws on a query error rather than returning a silently partial total.
export async function fetchAll<T>(
  make: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error?: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE;
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}
