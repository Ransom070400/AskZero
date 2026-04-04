import { NextResponse } from "next/server";
import { getOGTokenPrice } from "@/lib/og-token";

export async function GET() {
  const price = await getOGTokenPrice();
  return NextResponse.json({ price, currency: "USD" });
}
