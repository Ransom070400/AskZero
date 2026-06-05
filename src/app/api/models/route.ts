import { NextResponse } from "next/server";
import {
  INTEGRATE_PREFIX,
  listIntegrateModels,
} from "@/lib/integrate-network";
import { IMAGE_PREFIX, listImageModels } from "@/lib/image-generation";

// Only the models curated in `integrate-network.ts` are exposed. The 0G
// chain broker's listService() is intentionally not surfaced here — those
// providers vary in reliability, pricing and capability, so we ship a
// hand-picked, verified set instead of letting auto-discovery flood the
// picker.
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

  const imageModels = listImageModels().map((m) => ({
    provider: `${IMAGE_PREFIX}${m.id}`,
    model: m.id,
    label: m.label,
    description: m.description,
    supportsImages: false,
    kind: "image" as const,
    source: "z-image" as const,
  }));

  return NextResponse.json({ models: [...chatModels, ...imageModels] });
}
