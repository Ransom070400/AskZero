import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listIntegrateModels,
  wholesaleCostCredits,
} from "@/lib/integrate-network";
import { getZeroGUsdRate } from "@/lib/og-compute";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

interface UsageRow {
  amount: number | string;
  metadata: {
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
  } | null;
  created_at: string;
}

interface ModelAgg {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  revenueCredits: number;
  wholesaleCredits: number | null;
  marginCredits: number | null;
  marginPct: number | null;
}

async function probeGlmBalance() {
  const url = process.env.INTEGRATE_NETWORK_URL;
  const key = process.env.INTEGRATE_NETWORK_KEY;
  const integrate = listIntegrateModels()[0];
  if (!url || !key || !integrate) {
    return { status: "unconfigured" as const };
  }

  try {
    const r = await fetch(`${url.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: integrate.upstreamModel,
        messages: [{ role: "user", content: "." }],
        max_tokens: 1,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const text = await r.text();

    if (r.ok) {
      return {
        status: "ok" as const,
        message: "Balance sufficient (1-token probe succeeded).",
        topUpCommand: null,
      };
    }

    // Parse "your locked balance is X 0G, but the required minimum is Y 0G"
    const lockedMatch = text.match(
      /locked balance is\s+([\d.]+)\s+0G/i
    );
    const requiredMatch = text.match(
      /required minimum is\s+([\d.]+)\s+0G/i
    );
    const reserveMatch = text.match(
      /minimum reserve\s+([\d.]+)\s+0G/i
    );
    const unsettledMatch = text.match(
      /unsettled fees\s+([\d.]+)\s+0G/i
    );
    const providerMatch = text.match(/--provider\s+(0x[a-fA-F0-9]{40})/);

    const locked = lockedMatch ? parseFloat(lockedMatch[1]) : null;
    const required = requiredMatch ? parseFloat(requiredMatch[1]) : null;
    const reserve = reserveMatch ? parseFloat(reserveMatch[1]) : null;
    const unsettled = unsettledMatch ? parseFloat(unsettledMatch[1]) : null;
    const providerAddress = providerMatch ? providerMatch[1] : null;

    if (locked === null) {
      return {
        status: "error" as const,
        message: text.slice(0, 400),
        topUpCommand: null,
      };
    }

    const shortfall = required !== null ? required - locked : null;

    return {
      status: "insufficient" as const,
      lockedOG: locked,
      requiredOG: required,
      minReserveOG: reserve,
      unsettledFeesOG: unsettled,
      shortfallOG: shortfall,
      providerAddress,
      topUpCommand: providerAddress
        ? `0g-compute-cli transfer-fund --provider ${providerAddress} --amount 1`
        : null,
    };
  } catch (err) {
    return {
      status: "error" as const,
      message: err instanceof Error ? err.message : "probe failed",
      topUpCommand: null,
    };
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.min(
    Math.max(parseInt(new URL(req.url).searchParams.get("days") || "30", 10), 1),
    365
  );
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Platform-wide usage — must bypass RLS (which would scope this to the
  // admin's own transactions). Admin identity is verified above.
  const db = createAdminClient();
  const { data, error } = await db
    .from("transactions")
    .select("amount, metadata, created_at")
    .eq("type", "usage")
    .eq("status", "completed")
    .gte("created_at", since)
    .limit(50_000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<string, ModelAgg>();
  for (const row of (data || []) as UsageRow[]) {
    const model = row.metadata?.model || "unknown";
    const b = buckets.get(model) ?? {
      model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      revenueCredits: 0,
      wholesaleCredits: null,
      marginCredits: null,
      marginPct: null,
    };
    b.requests += 1;
    b.inputTokens += Number(row.metadata?.input_tokens) || 0;
    b.outputTokens += Number(row.metadata?.output_tokens) || 0;
    b.revenueCredits += Math.abs(Number(row.amount)) || 0;
    buckets.set(model, b);
  }

  const aggregates = Array.from(buckets.values()).map((b) => {
    const wholesale = wholesaleCostCredits(b.model, b.inputTokens, b.outputTokens);
    if (wholesale !== null) {
      b.wholesaleCredits = wholesale;
      b.marginCredits = b.revenueCredits - wholesale;
      b.marginPct =
        b.revenueCredits > 0
          ? (b.marginCredits / b.revenueCredits) * 100
          : null;
    }
    return b;
  });
  aggregates.sort((a, b) => b.revenueCredits - a.revenueCredits);

  const totals = aggregates.reduce(
    (acc, b) => {
      acc.requests += b.requests;
      acc.inputTokens += b.inputTokens;
      acc.outputTokens += b.outputTokens;
      acc.revenueCredits += b.revenueCredits;
      if (b.wholesaleCredits !== null) {
        acc.wholesaleCredits += b.wholesaleCredits;
      }
      return acc;
    },
    { requests: 0, inputTokens: 0, outputTokens: 0, revenueCredits: 0, wholesaleCredits: 0 }
  );
  const totalsMargin = totals.revenueCredits - totals.wholesaleCredits;

  const balance = await probeGlmBalance();

  return NextResponse.json({
    windowDays: days,
    zeroGUsdRate: getZeroGUsdRate(),
    aggregates,
    totals: {
      ...totals,
      revenueUsd: totals.revenueCredits / 1000,
      wholesaleUsd: totals.wholesaleCredits / 1000,
      marginCredits: totalsMargin,
      marginUsd: totalsMargin / 1000,
      marginPct:
        totals.revenueCredits > 0
          ? (totalsMargin / totals.revenueCredits) * 100
          : null,
    },
    glmBalance: balance,
  });
}
