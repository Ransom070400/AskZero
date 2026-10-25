import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCost,
  convertToCredits,
  creditsToUsdCents,
} from "../src/lib/pricing";
import {
  apacToCredits,
  formatApacCurrency,
  isApacCurrency,
  toStripeUnitAmount,
} from "../src/lib/pricing-apac";

test("calculateCost rounds up per-1K pricing and falls back to default", () => {
  assert.equal(calculateCost("default", 1000, 1000), 3);
  assert.equal(calculateCost("unknown-model", 1000, 1000), 3);
  assert.equal(calculateCost("glm-5.1", 1000, 1000), 8);
  assert.equal(calculateCost("default", 1, 0), 1);
  assert.equal(calculateCost("default", 0, 0), 0);
});

test("USD converts at 1000 credits per dollar, rounding down", async () => {
  assert.equal(await convertToCredits(5, "USD"), 5000);
  assert.equal(await convertToCredits(0.0019, "USD"), 1);
  assert.equal(creditsToUsdCents(1000), 100);
});

test("isApacCurrency only accepts listed codes, not inherited keys", () => {
  assert.equal(isApacCurrency("JPY"), true);
  assert.equal(isApacCurrency("USD"), false);
  assert.equal(isApacCurrency("jpy"), false);
  for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
    assert.equal(isApacCurrency(key), false, key);
  }
});

test("APAC amounts convert through the USD rate, rounding down", () => {
  assert.equal(apacToCredits(150, "JPY"), 1000);
  assert.equal(apacToCredits(1.35, "SGD"), 1000);
  assert.equal(apacToCredits(1, "VND"), 0);
});

test("Stripe unit amounts: whole units for zero-decimal currencies, else minor units", () => {
  assert.equal(toStripeUnitAmount(1500, "JPY"), 1500);
  assert.equal(toStripeUnitAmount(1499.6, "KRW"), 1500);
  assert.equal(toStripeUnitAmount(12.345, "SGD"), 1235);
});

test("APAC display uses the symbol and the currency's decimals", () => {
  assert.equal(formatApacCurrency(1500, "JPY"), "¥1,500");
  assert.equal(formatApacCurrency(5, "SGD"), "S$5.00");
});
