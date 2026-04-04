import { NextResponse } from "next/server";
import { listModels } from "@/lib/og-compute";

export async function GET() {
  const models = await listModels();

  // Always include a mock/default model for when 0G is unconfigured
  const allModels = [
    {
      provider: "mock",
      model: "default",
      url: "",
      inputPrice: "0",
      outputPrice: "0",
      serviceType: "chatbot",
      label: "Default (Mock)",
    },
    ...models.map((m) => ({
      ...m,
      label: m.model,
    })),
  ];

  return NextResponse.json({ models: allModels });
}
