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

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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

// Convert neuron price to credits cost
// 1 0G = 10^18 neuron, 1 credit = 0.1 cent = $0.001
export function neuronPriceToCredits(
  neuronPerToken: bigint,
  tokenCount: number
): number {
  // neuronPerToken * tokenCount = total neuron cost
  // Convert neuron to 0G: total / 10^18
  // Convert 0G to USD: assume 1 0G ~ $0.01 (adjust with market rate)
  // Convert USD to credits: USD * 1000
  const OG_TO_USD = 0.01; // configurable
  const totalNeuron = BigInt(neuronPerToken) * BigInt(tokenCount);
  const totalOG = Number(totalNeuron) / 1e18;
  const totalUSD = totalOG * OG_TO_USD;
  return Math.ceil(totalUSD * 1000); // USD to credits
}
