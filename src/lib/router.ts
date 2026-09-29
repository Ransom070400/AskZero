// 0G Router (Private Computer, pc.0g.ai) — one OpenAI/Anthropic-compatible API
// in front of 100+ chat models, billed from a single prepaid 0G balance on the
// Router's payment contract. Unlike the per-provider broker (og-compute.ts),
// there is no per-provider acknowledgement or sub-account deposit.
//
// The catalog comes from the public GET /v1/models: live per-token prices in
// neuron (same unit as the broker, so retail = wholesale × the same markups),
// input modalities, and each model's verifiability:
//   TeeML   — the model itself runs in an attested TEE
//   TeeTLS  — an attested TEE proxies to the upstream provider
//   (none)  — no attestation; the model identity is the router's claim
import type { ChatMessage } from "./og-compute";
import { sendAnthropic } from "./anthropic-adapter";

export const ROUTER_PREFIX = "router:";

const BASE_URL = (
  process.env.ROUTER_API_URL ?? "https://router-api.0g.ai/v1"
).replace(/\/+$/, "");

// Retail markups — same as integrate-network.ts / og-compute-models.ts.
const INPUT_MARKUP = 3.0;
const OUTPUT_MARKUP = 2.0;

export type RouterTrust = "tee" | "tee-route" | "none";

export interface RouterModel {
  id: string;
  name: string;
  description: string;
  created: number;
  wholesaleNeuron: { input: bigint; output: bigint };
  supportsImages: boolean;
  // Wire format we call it with: OpenAI chat/completions when offered,
  // otherwise Anthropic Messages (the Claude models are Anthropic-only).
  format: "openai" | "anthropic";
  trust: RouterTrust;
}

export function isRouterConfigured(): boolean {
  return Boolean(process.env.ROUTER_API_KEY);
}

interface RawModel {
  id: string;
  name?: string;
  description?: string;
  created?: number;
  type?: string;
  architecture?: { input_modalities?: string[] };
  supported_formats?: string[];
  pricing?: { prompt?: string; completion?: string };
  verifiability?: string | null;
}

function toRouterModel(m: RawModel): RouterModel | null {
  const formats = m.supported_formats ?? [];
  const format = formats.includes("openai")
    ? "openai"
    : formats.includes("anthropic")
      ? "anthropic"
      : null;
  if (m.type !== "chatbot" || !format || !m.pricing?.prompt) return null;
  return {
    id: m.id,
    name: m.name ?? m.id,
    description: m.description ?? "",
    created: m.created ?? 0,
    wholesaleNeuron: {
      input: BigInt(m.pricing.prompt),
      output: BigInt(m.pricing.completion ?? "0"),
    },
    supportsImages: (m.architecture?.input_modalities ?? []).includes("image"),
    format,
    trust:
      m.verifiability === "TeeML"
        ? "tee"
        : m.verifiability === "TeeTLS"
          ? "tee-route"
          : "none",
  };
}

// Module-level cache: prices and the catalog change rarely, and billing needs
// a synchronous lookup (see routerRetailCostCredits).
const CATALOG_TTL_MS = 10 * 60 * 1000;
let catalog: { at: number; models: RouterModel[] } | null = null;
let inflight: Promise<RouterModel[]> | null = null;

export async function loadRouterCatalog(): Promise<RouterModel[]> {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL_MS) return catalog.models;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: RawModel[] };
      const models = (body.data ?? [])
        .map(toRouterModel)
        .filter((m): m is RouterModel => m !== null);
      catalog = { at: Date.now(), models };
      return models;
    } catch (err) {
      console.error("0G Router catalog fetch failed:", err);
      // Serve stale prices over none; empty if we never loaded.
      return catalog?.models ?? [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Synchronous lookup against the loaded catalog. Callers that bill must
// `await loadRouterCatalog()` first.
export function findRouterModel(provider: string): RouterModel | undefined {
  const id = provider.startsWith(ROUTER_PREFIX)
    ? provider.slice(ROUTER_PREFIX.length)
    : provider;
  return catalog?.models.find((m) => m.id === id);
}

function neuronToCredits(neuron: bigint, tokens: number): number {
  // Mirrors og-compute.ts neuronPriceToCredits (kept local so this module
  // doesn't pull the broker SDK into the bundle).
  const og = Number(neuron * BigInt(tokens)) / 1e18;
  const rate = Number(process.env.ZERO_G_USD_RATE);
  const usdPerOg = Number.isFinite(rate) && rate > 0 ? rate : 0.5;
  return og * usdPerOg * 1000;
}

export function routerRetailCostCredits(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const m = findRouterModel(provider);
  if (!m) return null;
  return (
    neuronToCredits(m.wholesaleNeuron.input, inputTokens) * INPUT_MARKUP +
    neuronToCredits(m.wholesaleNeuron.output, outputTokens) * OUTPUT_MARKUP
  );
}

// Returns an OpenAI-shaped response (SSE when streaming) regardless of the
// model's wire format, so the chat route parses every source the same way.
export async function sendRouterPrompt(
  model: RouterModel,
  messages: ChatMessage[],
  options: { stream?: boolean } = {}
): Promise<Response> {
  const apiKey = process.env.ROUTER_API_KEY;
  if (!apiKey) throw new Error("0G Router is not configured (ROUTER_API_KEY)");

  if (model.format === "anthropic") {
    return sendAnthropic(
      BASE_URL,
      model.id,
      { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
      messages,
      { ...options, label: "0G Router" }
    );
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.id,
      messages,
      stream: options.stream ?? true,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `0G Router error (${response.status}): ${text.slice(0, 500)}`
    );
  }
  return response;
}
