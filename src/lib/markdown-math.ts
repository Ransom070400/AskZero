// remark-math treats any $…$ pair as inline math, so an answer mentioning two
// prices ("$0.05 … $1.05") renders as garbled LaTeX. Before rendering:
//  · a `$` directly followed by a digit is a currency amount → escaped (\$),
//  · \( … \) and \[ … \] (what many models emit) → $ … $ / $$ … $$,
// leaving fenced and inline code untouched. Real inline math ($x^2$,
// $\frac{a}{b}$) doesn't start with a digit, so it still renders.

// Code spans/blocks are copied through verbatim.
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

export function prepareMathMarkdown(md: string): string {
  return md
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : fixProse(part)))
    .join("");
}

function fixProse(text: string): string {
  return (
    text
      // Display math first so its `\[` isn't mistaken for anything else.
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`)
      // $12, $0.05, $1,200 — but not an already-escaped \$ or a $$ fence.
      .replace(/(^|[^\\$])\$(?=\d)/g, "$1\\$")
  );
}
