import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, rateLimitResponse } from "../src/lib/rate-limit";

test("allows up to the limit within a window, then blocks", () => {
  const key = "burst";
  assert.deepEqual(rateLimit(key, 3), { ok: true, remaining: 2 });
  assert.deepEqual(rateLimit(key, 3), { ok: true, remaining: 1 });
  assert.deepEqual(rateLimit(key, 3), { ok: true, remaining: 0 });
  assert.deepEqual(rateLimit(key, 3), { ok: false, remaining: 0 });
});

test("keys are counted independently", () => {
  rateLimit("a", 1);
  assert.equal(rateLimit("a", 1).ok, false);
  assert.equal(rateLimit("b", 1).ok, true);
});

test("the window resets after a minute", () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  try {
    rateLimit("window", 1);
    assert.equal(rateLimit("window", 1).ok, false);
    mock.timers.tick(60_001);
    assert.deepEqual(rateLimit("window", 1), { ok: true, remaining: 0 });
  } finally {
    mock.timers.reset();
  }
});

test("the 429 response is JSON", async () => {
  const res = rateLimitResponse();
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Content-Type"), "application/json");
  assert.match((await res.json()).error, /Too many requests/);
});
