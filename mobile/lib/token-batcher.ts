// Coalesces streamed text so the chat renders a growing answer ~20 times a
// second instead of once per token (each render re-parses the markdown).
// Call flush() before applying any other event, and when the stream ends.
export function createTokenBatcher(
  apply: (content: string, reasoning: string) => void,
  intervalMs = 50
) {
  let content = "";
  let reasoning = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!content && !reasoning) return;
    const c = content;
    const r = reasoning;
    content = "";
    reasoning = "";
    apply(c, r);
  };

  return {
    push(text: { content?: string; reasoning?: string }) {
      content += text.content ?? "";
      reasoning += text.reasoning ?? "";
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
    flush,
  };
}
