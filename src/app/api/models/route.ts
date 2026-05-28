import { NextResponse } from "next/server";
import {
  INTEGRATE_PREFIX,
  listIntegrateModels,
} from "@/lib/integrate-network";

// Only the models curated in `integrate-network.ts` are exposed. The 0G
// chain broker's listService() is intentionally not surfaced here — those
// providers vary in reliability, pricing and capability, so we ship a
// hand-picked, verified set instead of letting auto-discovery flood the
// picker.
export async function GET() {
  const integrateModels = listIntegrateModels();

  const models = integrateModels.map((m) => ({
    provider: `${INTEGRATE_PREFIX}${m.id}`,
    model: m.id,
    label: m.label,
    description: m.description,
    supportsImages: m.supportsImages,
    source: "integrate" as const,
  }));

  return NextResponse.json({ models });
}
