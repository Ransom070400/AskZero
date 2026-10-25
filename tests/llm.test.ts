import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, stripThinkTrace } from "../src/lib/llm";

test("stripThinkTrace keeps only what follows the last </think>", () => {
  assert.equal(stripThinkTrace("no trace"), "no trace");
  assert.equal(stripThinkTrace("hmm {draft}</think>\n  answer"), "answer");
  assert.equal(stripThinkTrace("a</think>b</think> c"), "c");
});

test("extractJson reads bare, fenced and prose-wrapped JSON", () => {
  assert.deepEqual(extractJson('["a","b"]'), ["a", "b"]);
  assert.deepEqual(extractJson('```json\n{"x":1}\n```'), { x: 1 });
  assert.deepEqual(extractJson('Sure! Here: ["q1", "q2"] Hope that helps.'), ["q1", "q2"]);
});

test("extractJson returns null when there's no parseable JSON", () => {
  assert.equal(extractJson("nothing here"), null);
  assert.equal(extractJson("{ not json }"), null);
  assert.equal(extractJson("] backwards ["), null);
});
