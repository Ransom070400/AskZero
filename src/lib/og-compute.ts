import { ethers } from "ethers";
import {
  createZGComputeNetworkBroker,
  createZGComputeNetworkReadOnlyBroker,
} from "@0glabs/0g-serving-broker";

type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;
type ReadOnlyBroker = Awaited<
  ReturnType<typeof createZGComputeNetworkReadOnlyBroker>
>;

let broker: Broker | null = null;
let readOnlyBroker: ReadOnlyBroker | null = null;

const RPC_URL =
  process.env.ZERO_G_CHAIN_RPC_URL || "https://evmrpc-testnet.0g.ai";

export async function getBroker(): Promise<Broker> {
  if (!broker) {
    const privateKey = process.env.ZERO_G_PRIVATE_KEY;
    if (!privateKey) throw new Error("ZERO_G_PRIVATE_KEY is not set");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    broker = await createZGComputeNetworkBroker(wallet);
  }
  return broker;
}

export async function getReadOnlyBroker(): Promise<ReadOnlyBroker> {
  if (!readOnlyBroker) {
    readOnlyBroker = await createZGComputeNetworkReadOnlyBroker(RPC_URL);
  }
  return readOnlyBroker;
}

export interface OGModel {
  provider: string;
  model: string;
  url: string;
  inputPrice: string; // neuron per token
  outputPrice: string;
  serviceType: string;
}

export async function listModels(): Promise<OGModel[]> {
  try {
    const b = await getReadOnlyBroker();
    const services = await b.inference.listService();

    return services
      .filter(
        (s: { serviceType: string }) =>
          s.serviceType === "chatbot" || s.serviceType === "chat"
      )
      .map(
        (s: {
          provider: string;
          model: string;
          url: string;
          inputPrice: bigint;
          outputPrice: bigint;
          serviceType: string;
        }) => ({
          provider: s.provider,
          model: s.model,
          url: s.url,
          inputPrice: s.inputPrice.toString(),
          outputPrice: s.outputPrice.toString(),
          serviceType: s.serviceType,
        })
      );
  } catch (err) {
    console.error("Failed to list 0G models:", err);
    return [];
  }
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

// Providers must be acknowledged on-chain once (per ledger wallet) before use.
// Track which we've handled this instance to avoid redundant calls.
const acknowledged = new Set<string>();

async function ensureAcknowledged(
  b: Broker,
  providerAddress: string
): Promise<void> {
  if (acknowledged.has(providerAddress)) return;
  try {
    await b.inference.acknowledgeProviderSigner(providerAddress);
  } catch (err) {
    // "already acknowledged" is expected and fine; anything else we let the
    // subsequent getRequestHeaders call surface.
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (!msg.includes("already") && !msg.includes("acknowledged")) {
      console.error("acknowledgeProviderSigner:", err);
    }
  }
  acknowledged.add(providerAddress);
}

// --- Anthropic (Messages API) adapter ---
// Some 0G Compute providers (e.g. claude-fable-5) speak Anthropic's Messages
// API, not OpenAI chat/completions. We translate the request and transform the
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

async function sendAnthropic(
  endpoint: string,
  model: string,
  headers: Record<string, string>,
  messages: ChatMessage[],
  options: { stream?: boolean }
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
    throw new Error(`0G Compute (Anthropic) error (${resp.status}): ${text}`);
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

export async function sendPrompt(
  providerAddress: string,
  messages: ChatMessage[],
  options: { stream?: boolean } = {}
): Promise<Response> {
  const b = await getBroker();

  await ensureAcknowledged(b, providerAddress);

  const { endpoint, model } = await b.inference.getServiceMetadata(
    providerAddress
  );
  const headers = await b.inference.getRequestHeaders(providerAddress);

  // Anthropic-format providers (claude-*) use the Messages API.
  if (/claude/i.test(model)) {
    return sendAnthropic(
      endpoint,
      model,
      headers as unknown as Record<string, string>,
      messages,
      options
    );
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: options.stream ?? true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`0G Compute error (${response.status}): ${text}`);
  }

  return response;
}

// Rough token estimation (1 token ~ 4 chars for English text)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// 1 0G = 10^18 neuron, 1 credit = 0.1¢ = $0.001
const NEURON_PER_OG = 1e18;
const CREDITS_PER_USD = 1000;

export function getZeroGUsdRate(): number {
  const raw = process.env.ZERO_G_USD_RATE;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.5;
}

// Convert an on-chain neuron-per-token rate to wholesale credits.
// Returns a fractional value — round at the call site if you need an integer.
export function neuronPriceToCredits(
  neuronPerToken: bigint | number,
  tokenCount: number
): number {
  const totalNeuron = Number(BigInt(neuronPerToken) * BigInt(tokenCount));
  const totalOG = totalNeuron / NEURON_PER_OG;
  const totalUSD = totalOG * getZeroGUsdRate();
  return totalUSD * CREDITS_PER_USD;
}
