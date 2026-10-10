import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/lib/tools";

test("basic arithmetic and precedence", () => {
  assert.equal(calculate("17*23"), "391");
  assert.equal(calculate("2 + 3 * 4"), "14");
  assert.equal(calculate("(2 + 3) * 4"), "20");
  assert.equal(calculate("10 / 4"), "2.5");
  assert.equal(calculate("10 % 4"), "2");
});

test("powers are right-associative and bind tighter than unary minus", () => {
  assert.equal(calculate("2^10"), "1024");
  assert.equal(calculate("2**3"), "8");
  assert.equal(calculate("2^3^2"), "512");
  assert.equal(calculate("-2^2"), "-4");
  assert.equal(calculate("2^-1"), "0.5");
});

test("commas are thousands separators", () => {
  assert.equal(calculate("1,200 * 3"), "3600");
});

test("rejects anything that isn't arithmetic", () => {
  assert.throws(() => calculate("alert(1)"));
  assert.throws(() => calculate("2 +"));
  assert.throws(() => calculate("(1 + 2"));
  assert.throws(() => calculate("1 2"));
  assert.throws(() => calculate("1 / 0"));
});
