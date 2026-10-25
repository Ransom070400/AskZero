import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateCredits,
  estimateInputTokens,
  TYPICAL_OUTPUT_TOKENS,
} from "../src/lib/estimate";

test("input tokens are ~4 chars each, rounded up, ignoring outer whitespace", () => {
  assert.equal(estimateInputTokens(""), 0);
  assert.equal(estimateInputTokens("abcd"), 1);
  assert.equal(estimateInputTokens("abcde"), 2);
  assert.equal(estimateInputTokens("   abcd   "), 1);
});

test("any input at all rounds a default-rate estimate up past the output cost", () => {
  // 500 output tokens at 2/1K = 1 credit; the tiny prompt rounds up to 2.
  assert.equal(estimateCredits("some-model", "hi"), 2);
});

test("GLM-5.1 ids pick the pricier fallback rate", () => {
  // 500 output tokens at 6/1K = 3 credits, plus a sliver of input.
  for (const id of ["glm-5.1", "GLM5.1", "zai/glm-5-1"]) {
    assert.equal(estimateCredits(id, "hi"), 4, id);
  }
});

test("an explicit rate overrides the id-based table", () => {
  const rate = { input: 0, output: 0 };
  assert.equal(estimateCredits("glm-5.1", "hello", rate), 1);
  assert.equal(
    estimateCredits("x", "a".repeat(4000), { input: 1, output: 0 }),
    1
  );
  assert.equal(
    estimateCredits("x", "a".repeat(8000), { input: 1, output: 0 }),
    2
  );
});

test("output dominates: the typical reply size is what's assumed", () => {
  const rate = { input: 0, output: 10 };
  assert.equal(
    estimateCredits("x", "", rate),
    Math.ceil((TYPICAL_OUTPUT_TOKENS / 1000) * 10)
  );
});
