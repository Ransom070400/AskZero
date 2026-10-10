// Turn the model's bracketed source numbers ("…in March [1][3].") into links
// the answer renderer shows as source chips (href "#cite-N").
//
// Leaves alone: code blocks and inline code, numbers with no matching source,
// array indexing like a[1] (preceded by a word character), and anything that
// is already a link or a reference definition ([1](…), [1]:).
const FENCE = /^\s*(```|~~~)/;
const CITE = /(?<!\w)\[(\d{1,2})\](?![(:])/g;

export function linkCitations(block: string, count: number): string {
  if (!count || FENCE.test(block)) return block;
  return block
    .split(/(`[^`\n]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part // inline code
        : part.replace(CITE, (match, n) => {
            const k = Number(n);
            return k >= 1 && k <= count ? `[${k}](#cite-${k})` : match;
          })
    )
    .join("");
}

export const CITE_PREFIX = "#cite-";
