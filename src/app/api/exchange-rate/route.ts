import { NextResponse } from "next/server";
import { getNgnPerUsd } from "@/lib/exchange-rate";

export async function GET() {
  const rate = await getNgnPerUsd();
  return NextResponse.json({ rate }, {
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
