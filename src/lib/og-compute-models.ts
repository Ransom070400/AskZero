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
export interface OGComputeModel {
  provider: string; // on-chain provider address (also the chat `provider` value)
  model: string; // model id reported by the provider
  label: string;
  description: string;
}

// NOTE: each provider needs its ledger sub-account funded once (transfer-fund /
// broker.ledger.depositFund) before it will serve requests. Only add a provider
// here after it's funded and smoke-tested, or the picker option will error.
export const OG_COMPUTE_MODELS: OGComputeModel[] = [
  {
    // Verified end-to-end (streaming + non-streaming) on 0G mainnet.
    provider: "0x7DCFe6AEa70350C2090041524c9B4A9262DCe87D",
    model: "zai-org/GLM-5.1-FP8",
    label: "GLM 5.1 · 0G Compute",
    description: "On-chain settled inference · decentralized 0G provider",
  },
];
