import { NextResponse } from "next/server";
import { listModels } from "@/lib/og-compute";

export async function GET() {
  const models = await listModels();

  return NextResponse.json({
    models: models.map((m) => ({
      ...m,
      label: m.model,
    })),
  });
}
