import { neuronPriceToCredits, type ChatMessage } from "@/lib/og-compute";
import { fetchUpstream, upstreamFailure, type UpstreamOptions } from "./upstream";

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
  // True only for vision-capable models. GLM 5.1 returns
  // "not a multimodal model" (400) when sent image_url parts, so we
  // gate image attachments client-side based on this flag.
  supportsImages: boolean;
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
      supportsImages: false,
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

// Retail markups applied on top of the on-chain wholesale cost. These are
// MULTIPLICATIVE, which is the whole point: because retail = wholesale ×
// markup, the margin percentage is preserved even when the 0G token price
// moves. A fixed credit table (the old MODEL_PRICING approach) is priced in
// USD while wholesale floats with 0G — so a 0G price spike could silently
// push wholesale above retail and make every message unprofitable. This
// can't invert. Input is the cheap hook (kept ~3x); output carries a 2x
// floor so reasoning-heavy replies stay comfortably profitable while still
// landing well under GPT-4o.
export const INPUT_MARKUP = 3.0;
export const OUTPUT_MARKUP = 2.0;

// Retail cost in credits = wholesale × markup, rounded up, min 1 credit.
// Returns null if the model isn't an Integrate model (or the network env is
// unset) so the caller can fall back to the static MODEL_PRICING table.
export function retailCostCredits(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const m = listIntegrateModels().find((x) => x.id === modelId);
  if (!m) return null;
  const retail =
    neuronPriceToCredits(m.wholesaleNeuron.input, inputTokens) * INPUT_MARKUP +
    neuronPriceToCredits(m.wholesaleNeuron.output, outputTokens) * OUTPUT_MARKUP;
  return Math.max(Math.ceil(retail), 1);
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
  options: UpstreamOptions = {}
): Promise<Response> {
  const url = `${model.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const stream = options.stream ?? true;

  const response = await fetchUpstream(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.upstreamModel,
      messages,
      stream,
      // Ask for real token counts in the final chunk, so billing doesn't rely
      // on a chars/4 estimate.
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      // GLM 5.1 is a reasoning model — thinking is on by default and emits
      // tokens into `reasoning` instead of `content`. The chat UI only renders
      // `content`, so disable thinking to keep replies visible.
      chat_template_kwargs: { enable_thinking: false },
    }),
  }, options.signal);

  if (!response.ok) throw await upstreamFailure("Integrate Network", response);
  return response;
}
