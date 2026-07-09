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
];

// Live 0G Compute chatbot providers we haven't wired up yet. Shown in the
// picker as disabled "Soon" entries (UI only — not selectable, not integrated)
// so users can see what's coming. Addresses/models from listService() (mainnet).
export const OG_COMPUTE_COMING_SOON: {
  provider: string;
  model: string;
  label: string;
}[] = [
  { provider: "0x1F444c8A8D0b8e99A50e9f165806d28B01916E04", model: "claude-fable-5", label: "Claude Fable 5" },
  { provider: "0xF203A388e9E70F09ece38046a6D40a89cf896309", model: "qwen3.7-max", label: "Qwen 3.7 Max" },
  { provider: "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0", model: "qwen3.7-plus", label: "Qwen 3.7 Plus" },
  { provider: "0x992e6396157Dc4f22E74F2231235D7DE62696db5", model: "qwen3.6-plus", label: "Qwen 3.6 Plus" },
  { provider: "0x4415ef5CBb415347bb18493af7cE01f225Fc0868", model: "qwen/qwen3-vl-30b-a3b-instruct", label: "Qwen3-VL 30B" },
  { provider: "0xB01EBd79c3fd63ff52fD47C3935119601EEe2FdB", model: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { provider: "0x61C0007197E7D4d6A842d6768E8035728877B9F6", model: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { provider: "0xDB7B465300B0acf454867683c5481055f698b2e8", model: "glm-5.1", label: "GLM 5.1" },
  { provider: "0xb1242816181a87F597B01CE673cdadEb1c723bbF", model: "glm-5", label: "GLM 5" },
  { provider: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C", model: "zai-org/GLM-5-FP8", label: "GLM 5 FP8" },
  { provider: "0xa6581CfDc65278cC539e94d864012ce4B35c5D56", model: "MiniMax-M3", label: "MiniMax M3" },
  { provider: "0x25F8f01cA76060ea40895472b1b79f76613Ca497", model: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { provider: "0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9", model: "0GM-1.0-35B-A3B", label: "0GM 1.0 35B" },
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
