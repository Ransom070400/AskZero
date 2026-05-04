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

export async function sendPrompt(
  providerAddress: string,
  messages: ChatMessage[],
  options: { stream?: boolean } = {}
): Promise<Response> {
  const b = await getBroker();

  const { endpoint, model } = await b.inference.getServiceMetadata(
    providerAddress
  );
  const headers = await b.inference.getRequestHeaders(providerAddress);

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
