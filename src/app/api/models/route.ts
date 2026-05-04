import { NextResponse } from "next/server";
import { listModels } from "@/lib/og-compute";
import {
  INTEGRATE_PREFIX,
  listIntegrateModels,
} from "@/lib/integrate-network";

export async function GET() {
  const [chainModels, integrateModels] = await Promise.all([
    listModels(),
    Promise.resolve(listIntegrateModels()),
  ]);

  const integrateEntries = integrateModels.map((m) => ({
    provider: `${INTEGRATE_PREFIX}${m.id}`,
    model: m.id,
    label: m.label,
    description: m.description,
    source: "integrate" as const,
  }));

  const chainEntries = chainModels.map((m) => ({
    ...m,
    label: m.model,
    source: "chain" as const,
  }));

  return NextResponse.json({
    models: [...integrateEntries, ...chainEntries],
  });
}
