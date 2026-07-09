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
  {
    // Verified end-to-end (streaming + non-streaming) on 0G mainnet.
    provider: "0x7DCFe6AEa70350C2090041524c9B4A9262DCe87D",
    model: "glm-5.2",
    label: "GLM 5.2 · 0G Compute",
    description: "On-chain settled inference · decentralized 0G provider",
    wholesaleNeuron: { input: 4_800_000_000_000, output: 16_020_000_000_000 },
  },
  {
    // Anthropic-format provider (Messages API) — served via the broker, settled
    // on-chain. Standard (not TEE) verifiability; see og-compute.ts adapter.
    provider: "0x1F444c8A8D0b8e99A50e9f165806d28B01916E04",
    model: "claude-fable-5",
    label: "Claude Fable 5 · 0G Compute",
    description: "Frontier model · on-chain settled on 0G Compute",
    wholesaleNeuron: { input: 48_070_000_000_000, output: 240_350_000_000_000 },
    multimodal: true,
  },
];

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
