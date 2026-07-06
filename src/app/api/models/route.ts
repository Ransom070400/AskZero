import { NextResponse } from "next/server";
import {
  INTEGRATE_PREFIX,
  listIntegrateModels,
} from "@/lib/integrate-network";
import { IMAGE_PREFIX, listImageModels } from "@/lib/image-generation";
import { OG_COMPUTE_MODELS } from "@/lib/og-compute-models";

// We expose two sets of chat models:
//  · Integrate gateway models (TEE-verified OpenAI-compatible proxy), and
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
  }));

  const ogComputeModels = OG_COMPUTE_MODELS.map((m) => ({
    provider: m.provider, // raw 0x address → chat route routes to the broker
    model: m.model,
    label: m.label,
    description: m.description,
    supportsImages: false,
    kind: "chat" as const,
    source: "og" as const,
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
    models: [...chatModels, ...ogComputeModels, ...imageModels],
  });
}
