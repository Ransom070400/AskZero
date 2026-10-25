// Client-side helpers for reading the chat route's SSE stream.

// Fired when a chat was created, retitled or updated, so the sidebar refreshes
// without waiting for the next navigation.
export const CHATS_CHANGED_EVENT = "askzero:chats-changed";

// Read `data: …` events until the stream ends, calling onEvent with each
// parsed JSON payload. [DONE] and malformed events are skipped.
export async function readSSE<T = Record<string, unknown>>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (frame: string) => {
    const data = frame.replace(/^data: /, "");
    if (!data || data === "[DONE]") return;
    let event: T;
    try {
      event = JSON.parse(data);
    } catch {
      return; // skip malformed chunks
    }
    onEvent(event);
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    frames.forEach(emit);
  }
  // A last event the stream closed on without its trailing blank line.
  emit((buffer + decoder.decode()).trim());
}

// Coalesces streamed text so React renders a growing answer ~30 times a
// second instead of once per token. A timer rather than requestAnimationFrame,
// which doesn't fire in background tabs. Call flush() before applying any
// other event so updates stay in order, and when the stream ends.
export function createTokenBatcher(
  apply: (content: string, reasoning: string) => void,
  intervalMs = 32
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
