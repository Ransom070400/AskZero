import type { ChatMessage, ContentPart } from "./og-compute";
import { fetchUpstream, upstreamFailure, type UpstreamOptions } from "./upstream";

// Anthropic (Messages API) adapter.
// Claude models — on 0G Compute providers and on the 0G Router — speak
// Anthropic's Messages API, not OpenAI chat/completions. We translate the request and transform the
// response back into the OpenAI SSE shape the chat route already parses, so the
// caller doesn't need to know which format the provider uses.

// The Messages API rejects empty text blocks (and empty string content), which
// an image-only turn or an empty saved answer would otherwise produce — and one
// such turn would break every later request in the chat.
function partsToAnthropic(content: string | ContentPart[]) {
  if (typeof content === "string") return content.trim() ? content : "(empty)";
  const parts = content
    .filter((p) => p.type === "image_url" || p.text.trim())
    .map((p) =>
      p.type === "image_url"
        ? { type: "image", source: { type: "url", url: p.image_url.url } }
        : { type: "text", text: p.text }
    );
  return parts.length > 0 ? parts : "(empty)";
}

// Anthropic stop_reason → OpenAI finish_reason.
function finishReason(stop: string | undefined): string | null {
  if (!stop) return null;
  return stop === "max_tokens" ? "length" : "stop";
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
  const emit = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    obj: unknown
  ) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let stop: string | undefined;
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
            let ev;
            try {
              ev = JSON.parse(data);
            } catch {
              continue; // skip malformed chunk
            }
            if (ev.type === "message_start") {
              inputTokens =
                (ev.message?.usage?.input_tokens ?? 0) +
                (ev.message?.usage?.cache_read_input_tokens ?? 0) +
                (ev.message?.usage?.cache_creation_input_tokens ?? 0);
            } else if (ev.type === "message_delta") {
              outputTokens = ev.usage?.output_tokens ?? outputTokens;
              stop = ev.delta?.stop_reason ?? stop;
            } else if (ev.type === "error") {
              // e.g. overloaded_error mid-stream — pass it on, OpenAI-style.
              console.error("Anthropic stream error", ev.error);
              emit(controller, { error: { message: ev.error?.type ?? "error" } });
            } else if (ev.type === "content_block_delta") {
              // Answer text → content; extended thinking → reasoning_content
              // (the chat route shows it as a Thinking panel). Signature
              // deltas are skipped.
              const delta =
                ev.delta?.type === "text_delta" && ev.delta.text
                  ? { content: ev.delta.text }
                  : ev.delta?.type === "thinking_delta" && ev.delta.thinking
                    ? { reasoning_content: ev.delta.thinking }
                    : null;
              if (delta) emit(controller, { choices: [{ delta }] });
            }
          }
        }
        // Final chunk in the include_usage shape the chat route reads.
        emit(controller, {
          choices: [{ delta: {}, finish_reason: finishReason(stop) }],
          ...(inputTokens || outputTokens
            ? { usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens } }
            : {}),
        });
      } catch (err) {
        // Upstream dropped mid-answer — say so rather than ending as if done.
        console.error("Anthropic stream read failed", err);
        emit(controller, { error: { message: "stream interrupted" } });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
    cancel(reason) {
      return resp.body?.cancel(reason);
    },
  });
}

export async function sendAnthropic(
  endpoint: string,
  model: string,
  headers: Record<string, string>,
  messages: ChatMessage[],
  options: UpstreamOptions & { label?: string }
): Promise<Response> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => partsToText(m.content))
    .join("\n\n");
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: partsToAnthropic(m.content) }));

  const stream = options.stream ?? true;
  const resp = await fetchUpstream(`${endpoint}/messages`, {
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
  }, options.signal);

  if (!resp.ok) {
    throw await upstreamFailure(`${options.label ?? "0G Compute"} (Anthropic)`, resp);
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
