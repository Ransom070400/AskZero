import { neuronPriceToCredits, type ChatMessage } from "@/lib/og-compute";

export interface IntegrateModel {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  // On-chain wholesale rates from the provider's /v1/models listing,
  // in neuron-per-token. 1 0G = 1e18 neuron.
  wholesaleNeuron: { input: number; output: number };
}

export const INTEGRATE_PREFIX = "integrate:";

function rawManifest(): Omit<IntegrateModel, "baseUrl" | "apiKey">[] {
  return [
    {
      id: "glm-5.1",
      label: "GLM 5.1",
      description: "Zhipu · 0G mainnet · TEE-verified",
      upstreamModel: "glm-5.1-fp8",
      wholesaleNeuron: { input: 934_000_000_000, output: 7_800_000_000_000 },
    },
  ];
}

// Wholesale cost in credits at the current ZERO_G_USD_RATE.
// Returns a float — caller decides on rounding. Useful for live margin checks.
export function wholesaleCostCredits(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const m = listIntegrateModels().find((x) => x.id === modelId);
  if (!m) return null;
  return (
    neuronPriceToCredits(m.wholesaleNeuron.input, inputTokens) +
    neuronPriceToCredits(m.wholesaleNeuron.output, outputTokens)
  );
}

export function listIntegrateModels(): IntegrateModel[] {
  const baseUrl = process.env.INTEGRATE_NETWORK_URL;
  const apiKey = process.env.INTEGRATE_NETWORK_KEY;
  if (!baseUrl || !apiKey) return [];

  return rawManifest().map((m) => ({ ...m, baseUrl, apiKey }));
}

export function findIntegrateModel(
  providerOrId: string
): IntegrateModel | null {
  const id = providerOrId.startsWith(INTEGRATE_PREFIX)
    ? providerOrId.slice(INTEGRATE_PREFIX.length)
    : providerOrId;
  return listIntegrateModels().find((m) => m.id === id) ?? null;
}

export async function sendIntegratePrompt(
  model: IntegrateModel,
  messages: ChatMessage[],
  options: { stream?: boolean } = {}
): Promise<Response> {
  const url = `${model.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.upstreamModel,
      messages,
      stream: options.stream ?? true,
      // GLM 5.1 is a reasoning model — thinking is on by default and emits
      // tokens into `reasoning` instead of `content`. The chat UI only renders
      // `content`, so disable thinking to keep replies visible.
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Integrate Network error (${response.status}): ${text.slice(0, 500)}`
    );
  }
  return response;
}
