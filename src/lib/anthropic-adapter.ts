import type { ChatMessage, ContentPart } from "./og-compute";

// Anthropic (Messages API) adapter.
// Claude models — on 0G Compute providers and on the 0G Router — speak
// Anthropic's Messages API, not OpenAI chat/completions. We translate the request and transform the
// response back into the OpenAI SSE shape the chat route already parses, so the
// caller doesn't need to know which format the provider uses.

function partsToAnthropic(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((p) =>
    p.type === "image_url"
      ? { type: "image", source: { type: "url", url: p.image_url.url } }
      : { type: "text", text: p.text }
  );
}

function partsToText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function anthropicToOpenAISSE(resp: Response): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const ev = JSON.parse(data);
              // Only the answer text — skip thinking / signature deltas.
              if (
                ev.type === "content_block_delta" &&
                ev.delta?.type === "text_delta" &&
                ev.delta.text
              ) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: ev.delta.text } }],
                    })}\n\n`
                  )
                );
              }
            } catch {
              /* skip malformed chunk */
            }
          }
        }
      } catch {
        /* upstream stream error — fall through to close cleanly */
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

export async function sendAnthropic(
  endpoint: string,
  model: string,
  headers: Record<string, string>,
  messages: ChatMessage[],
  options: { stream?: boolean; label?: string }
): Promise<Response> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => partsToText(m.content))
    .join("\n\n");
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: partsToAnthropic(m.content) }));

  const stream = options.stream ?? true;
  const resp = await fetch(`${endpoint}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...headers,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      // This provider requires `system` as content blocks, not a bare string
      // (a string 500s with "upstream error").
      ...(system ? { system: [{ type: "text", text: system }] } : {}),
      messages: anthropicMessages,
      stream,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `${options.label ?? "0G Compute"} (Anthropic) error (${resp.status}): ${text.slice(0, 500)}`
    );
  }

  if (stream) {
    return new Response(anthropicToOpenAISSE(resp), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const j = await resp.json();
  const text = (j.content ?? [])
    .filter((bk: { type: string }) => bk.type === "text")
    .map((bk: { text: string }) => bk.text)
    .join("");
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: text } }],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
