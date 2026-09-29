import { NextResponse } from "next/server";
import {
  INTEGRATE_PREFIX,
  listIntegrateModels,
  retailCostCredits,
} from "@/lib/integrate-network";
import { IMAGE_PREFIX, listImageModels } from "@/lib/image-generation";
import {
  ROUTER_PREFIX,
  isRouterConfigured,
  loadRouterCatalog,
  routerRetailCostCredits,
} from "@/lib/router";
import {
  OG_COMPUTE_MODELS,
  OG_COMPUTE_COMING_SOON,
  ogRetailCostCredits,
} from "@/lib/og-compute-models";

// Retail credits per 1K input / output tokens, from the same functions that
// bill the message — so the cost meter and Premium badge track real prices.
// Priced over 1M tokens then scaled, to dodge the per-message 1-credit floor.
function per1k(
  cost: (inputTokens: number, outputTokens: number) => number | null
): { input: number; output: number } | undefined {
  const input = cost(1_000_000, 0);
  const output = cost(0, 1_000_000);
  if (input == null || output == null) return undefined;
  return {
    input: Math.round(input) / 1000,
    output: Math.round(output) / 1000,
  };
}

// "openai/gpt-5.4-mini" / "GPT-5.4-Mini" → "gpt-5.4-mini", to spot the same
// model offered by both the broker and the router.
const normalizeId = (id: string) => id.toLowerCase().replace(/^.*\//, "");

// We expose three sets of chat models:
//  · Integrate gateway models (TEE-verified OpenAI-compatible proxy),
//  · the 0G Router catalog (100+ models behind one API key), and
//  · a hand-picked set of 0G Compute broker providers (on-chain settled).
// The broker's full listService() is intentionally NOT auto-surfaced — those
// providers vary in reliability/pricing — so we ship a verified curated set.
export async function GET() {
  const chatModels = listIntegrateModels().map((m) => ({
    provider: `${INTEGRATE_PREFIX}${m.id}`,
    model: m.id,
    label: m.label,
    description: m.description,
    supportsImages: m.supportsImages,
    kind: "chat" as const,
    source: "integrate" as const,
    pricePer1k: per1k((i, o) => retailCostCredits(m.id, i, o)),
  }));

  // Until ROUTER_API_KEY is set the catalog still shows, as disabled "Soon"
  // entries, so the picker previews what's coming.
  const routerReady = isRouterConfigured();
  const routerCatalog = await loadRouterCatalog();
  const routerModels = routerCatalog.map((m) => ({
    provider: `${ROUTER_PREFIX}${m.id}`,
    model: m.id,
    label: m.name,
    description: m.description,
    supportsImages: m.supportsImages,
    kind: "chat" as const,
    source: "router" as const,
    trust: m.trust,
    created: m.created,
    pricePer1k: per1k((i, o) =>
      routerRetailCostCredits(`${ROUTER_PREFIX}${m.id}`, i, o)
    ),
    ...(routerReady ? {} : { comingSoon: true as const }),
  }));
  // Once the router is live it's cheaper and needs no per-provider deposit,
  // so it supersedes broker providers serving the same model.
  const routerIds = new Set(
    routerReady ? routerCatalog.map((m) => normalizeId(m.id)) : []
  );

  const ogComputeModels = OG_COMPUTE_MODELS.filter(
    (m) => !routerIds.has(normalizeId(m.model))
  ).map((m) => ({
    provider: m.provider, // raw 0x address → chat route routes to the broker
    model: m.model,
    label: m.label,
    description: m.description,
    supportsImages: m.multimodal ?? false,
    kind: "chat" as const,
    source: "og" as const,
    pricePer1k: per1k((i, o) => ogRetailCostCredits(m.provider, i, o)),
  }));

  // UI-only preview: real 0G Compute providers, not yet wired up. Rendered
  // disabled ("Soon") in the picker — never selectable.
  const comingSoonModels = OG_COMPUTE_COMING_SOON.map((m) => ({
    provider: m.provider,
    model: m.model,
    label: m.label,
    description: "",
    supportsImages: false,
    kind: "chat" as const,
    source: "og" as const,
    comingSoon: true as const,
  }));

  const imageModels = listImageModels().map((m) => ({
    provider: `${IMAGE_PREFIX}${m.id}`,
    model: m.id,
    label: m.label,
    description: m.description,
    supportsImages: false,
    kind: "image" as const,
    source: "z-image" as const,
  }));

  return NextResponse.json({
    models: [
      ...chatModels,
      ...ogComputeModels,
      ...routerModels,
      ...comingSoonModels,
      ...imageModels,
    ],
  });
}
