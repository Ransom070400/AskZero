/**
 * Smoke-test every curated 0G Compute chat model (OG_COMPUTE_MODELS).
 *
 * For each provider: acknowledge it (one-time, on-chain), send a tiny
 * non-streaming prompt, and print what the provider's response says it ran
 * (the `model` field) next to the reply. Spends a few thousandths of a 0G per
 * model from the shared ledger.
 *
 * Usage:
 *   npx tsx scripts/smoke-og-models.ts            # all models
 *   npx tsx scripts/smoke-og-models.ts claude     # only models matching
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const PROMPT =
  "Which model are you? Reply with only your model name and version, nothing else.";

async function main() {
  // Imported after dotenv so og-compute picks up the RPC URL / key.
  const { getBroker } = await import("../src/lib/og-compute");
  const { OG_COMPUTE_MODELS } = await import("../src/lib/og-compute-models");

  const filter = process.argv[2]?.toLowerCase();
  const models = OG_COMPUTE_MODELS.filter(
    (m) => !filter || `${m.model} ${m.label}`.toLowerCase().includes(filter)
  );
  const b = await getBroker();

  let failures = 0;
  for (const m of models) {
    const started = Date.now();
    try {
      try {
        await b.inference.acknowledgeProviderSigner(m.provider);
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (!msg.includes("already") && !msg.includes("acknowledged")) throw err;
      }

      const { endpoint, model } = await b.inference.getServiceMetadata(m.provider);
      const headers = (await b.inference.getRequestHeaders(
        m.provider
      )) as unknown as Record<string, string>;
      const anthropic = /claude/i.test(model);

      const resp = await fetch(
        `${endpoint}/${anthropic ? "messages" : "chat/completions"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(anthropic ? { "anthropic-version": "2023-06-01" } : {}),
            ...headers,
          },
          body: JSON.stringify({
            model,
            max_tokens: 40,
            messages: [{ role: "user", content: PROMPT }],
            stream: false,
          }),
        }
      );
      const body = await resp.text();
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${body.slice(0, 300)}`);

      const j = JSON.parse(body);
      const reply = anthropic
        ? (j.content ?? [])
            .filter((bk: { type: string }) => bk.type === "text")
            .map((bk: { text: string }) => bk.text)
            .join("")
        : j.choices?.[0]?.message?.content ?? "";

      console.log(
        [
          `✔ ${m.label}`,
          `  provider   ${m.provider}`,
          `  registered ${model}   (ours: ${m.model})`,
          `  responded  ${j.model ?? "(no model field)"}`,
          `  reply      ${JSON.stringify(String(reply).trim().slice(0, 120))}`,
          `  time       ${((Date.now() - started) / 1000).toFixed(1)}s`,
        ].join("\n")
      );
    } catch (err) {
      failures++;
      console.log(
        `✘ ${m.label}\n  provider   ${m.provider}\n  error      ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  console.log(`\n${models.length - failures}/${models.length} models OK`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
