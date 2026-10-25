import { ethers } from "ethers";
import { sendAnthropic } from "./anthropic-adapter";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { fetchUpstream, upstreamFailure, type UpstreamOptions } from "./upstream";

type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

let broker: Broker | null = null;

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
      return; // not acknowledged — try again on the next request
    }
  }
  acknowledged.add(providerAddress);
}

export async function sendPrompt(
  providerAddress: string,
  messages: ChatMessage[],
  options: UpstreamOptions = {}
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

  const stream = options.stream ?? true;
  const response = await fetchUpstream(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
  }, options.signal);

  if (!response.ok) throw await upstreamFailure("0G Compute", response);

  return response;
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
