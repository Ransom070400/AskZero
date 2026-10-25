import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeInput, validateMessage } from "../src/lib/sanitize";

test("sanitizeInput trims and caps at 10,000 characters", () => {
  assert.equal(sanitizeInput("  hi  "), "hi");
  assert.equal(sanitizeInput("a".repeat(12_000)).length, 10_000);
});

test("validateMessage rejects empty and whitespace-only messages", () => {
  assert.equal(validateMessage("").valid, false);
  assert.equal(validateMessage("   \n\t").valid, false);
  assert.deepEqual(validateMessage("hello"), { valid: true });
});

test("validateMessage rejects messages over the limit", () => {
  assert.equal(validateMessage("a".repeat(10_000)).valid, true);
  const tooLong = validateMessage("a".repeat(10_001));
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.error ?? "", /too long/);
});
