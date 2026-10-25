import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  findRouterModel,
  loadRouterCatalog,
  routerRetailCostCredits,
} from "../src/lib/router";

const raw = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "chatbot",
  supported_formats: ["openai"],
  // 1e12 neuron/token = 1e-6 0G/token.
  pricing: { prompt: "1000000000000", completion: "2000000000000" },
  ...extra,
});

test("catalog keeps priced chat models, skipping bad entries without failing", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({
      data: [
        raw("good", { verifiability: "TeeML", architecture: { input_modalities: ["image"] } }),
        raw("anthropic-only", { supported_formats: ["anthropic"], verifiability: "TeeTLS" }),
        raw("decimal-price", { pricing: { prompt: "0.5" } }),
        raw("embedder", { type: "embedding" }),
        raw("no-format", { supported_formats: ["other"] }),
        raw("unpriced", { pricing: {} }),
      ],
    })
  );
  try {
    const models = await loadRouterCatalog();
    assert.deepEqual(models.map((m) => m.id), ["good", "anthropic-only"]);
    const good = findRouterModel("router:good");
    assert.equal(good?.trust, "tee");
    assert.equal(good?.supportsImages, true);
    assert.equal(good?.format, "openai");
    assert.equal(findRouterModel("anthropic-only")?.trust, "tee-route");
    assert.equal(findRouterModel("anthropic-only")?.format, "anthropic");
  } finally {
    fetchMock.mock.restore();
  }
});

test("retail cost applies the 3x input / 2x output markups", () => {
  process.env.ZERO_G_USD_RATE = "1";
  // 1000 input tokens: 1e-3 0G = $0.001 = 1 credit wholesale, ×3.
  // 1000 output tokens: 2e-3 0G = 2 credits wholesale, ×2.
  const cost = routerRetailCostCredits("router:good", 1000, 1000);
  assert.ok(cost !== null && Math.abs(cost - 7) < 1e-9, String(cost));
  assert.equal(routerRetailCostCredits("router:missing", 1, 1), null);
});
