// Curated 0G Compute broker models surfaced in the picker.
//
// These route through `og-compute.ts` sendPrompt(): the request is signed and
// settled on-chain via the shared 0G ledger, and served by a decentralized
// provider on the 0G Compute Network (mainnet, chain 16661). This is genuine
// on-chain-settled inference — not the Integrate gateway.
//
// We hand-pick verified providers rather than surfacing the full listService()
// set (which varies in reliability/pricing). Each provider must be acknowledged
// once on-chain with the ledger wallet before first use (sendPrompt does this
// lazily; scripts/setup-0g.ts can pre-acknowledge).
import { neuronPriceToCredits } from "./og-compute";

export interface OGComputeModel {
  provider: string; // on-chain provider address (also the chat `provider` value)
  model: string; // model id reported by the provider
  label: string;
  description: string;
  // On-chain wholesale rates (neuron per token) from listService(), used to
  // price retail as wholesale × markup so margin can't invert when 0G moves.
  wholesaleNeuron: { input: number; output: number };
  multimodal?: boolean;
}

// NOTE: each provider draws from the shared ledger sub-account; the ledger must
// be funded once (scripts/setup-0g.ts / broker.ledger.depositFund) before use.
// Only add a provider here after it's funded and smoke-tested, or the picker
// option will error.
export const OG_COMPUTE_MODELS: OGComputeModel[] = [
  // Addresses, model ids and wholesale rates from listService() on mainnet
  // (2026-09-29). Re-check when a provider errors — providers come and go.
  {
    // Verified end-to-end (streaming + non-streaming) on 0G mainnet.
    // This provider upgraded glm-5.2 → glm-5.3 in place.
    provider: "0x7DCFe6AEa70350C2090041524c9B4A9262DCe87D",
    model: "glm-5.3",
    label: "GLM 5.3 · 0G Compute",
    description: "Z.ai's latest GLM · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 4_820_000_000_000, output: 15_150_000_000_000 },
  },
  {
    provider: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
    model: "zai-org/GLM-5-FP8",
    label: "GLM 5 FP8 · 0G Compute",
    description: "Previous-generation GLM · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 17_940_000_000_000, output: 89_740_000_000_000 },
  },
  {
    // Anthropic-format provider (Messages API) — served via the broker, settled
    // on-chain. Standard (not TEE) verifiability; see og-compute.ts adapter.
    provider: "0xd3f02c1a04160389d98D2192AE2034159f731011",
    model: "claude-opus-5",
    label: "Claude Opus 5 · 0G Compute",
    description:
      "Frontier reasoning — strongest here, premium price · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 38_960_000_000_000, output: 175_340_000_000_000 },
    multimodal: true,
  },
  {
    // Anthropic-format provider — same adapter as Opus.
    provider: "0x1F444c8A8D0b8e99A50e9f165806d28B01916E04",
    model: "claude-fable-5",
    label: "Claude Fable 5 · 0G Compute",
    description:
      "Frontier reasoning — most expensive here · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 87_300_000_000_000, output: 327_370_000_000_000 },
    multimodal: true,
  },
  {
    provider: "0x25F8f01cA76060ea40895472b1b79f76613Ca497",
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini · 0G Compute",
    description: "Fast, low-cost OpenAI model · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 1_600_000_000_000, output: 9_000_000_000_000 },
  },
  {
    provider: "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0",
    model: "qwen3.7-plus",
    label: "Qwen 3.7 Plus · 0G Compute",
    description: "Alibaba's Qwen · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 18_050_000_000_000, output: 90_250_000_000_000 },
  },
  {
    provider: "0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9",
    model: "0GM-1.0-35B-A3B",
    label: "0GM 1.0 · 0G Compute",
    description: "0G's own model — cheapest here · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 278_000_000_000, output: 1_670_000_000_000 },
  },
  {
    provider: "0xf56fAaf9989aDafDDf26fa5Ffdd03a9A27b38fAE",
    model: "0GM-1.0-35B-A3B-SIA",
    label: "0GM 1.0 SIA · 0G Compute",
    description: "0GM 1.0 variant · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 1_910_000_000_000, output: 11_500_000_000_000 },
  },
];

// Live 0G Compute chatbot providers we haven't wired up yet. Shown in the
// picker as disabled "Soon" entries (UI only — not selectable, not integrated)
// so users can see what's coming. Addresses/models from listService() (mainnet).
// Empty: every live chatbot provider is wired up above.
export const OG_COMPUTE_COMING_SOON: {
  provider: string;
  model: string;
  label: string;
}[] = [];

// Retail markups on the on-chain wholesale cost (multiplicative → margin holds
// when the 0G token price moves). Mirrors integrate-network.ts.
const INPUT_MARKUP = 3.0;
const OUTPUT_MARKUP = 2.0;

// Retail credit cost for a 0G Compute broker provider, or null if the provider
// isn't one of ours (caller falls back to the static table).
export function ogRetailCostCredits(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const m = OG_COMPUTE_MODELS.find(
    (x) => x.provider.toLowerCase() === provider.toLowerCase()
  );
  if (!m) return null;
  return (
    neuronPriceToCredits(m.wholesaleNeuron.input, inputTokens) * INPUT_MARKUP +
    neuronPriceToCredits(m.wholesaleNeuron.output, outputTokens) * OUTPUT_MARKUP
  );
}
