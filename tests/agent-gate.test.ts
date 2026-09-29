import test from "node:test";
import assert from "node:assert/strict";
import { routeAgent } from "../src/lib/agent-gate";

const kind = (m: string, o?: { hasAttachments?: boolean }) => routeAgent(m, o).kind;

test("small talk and self-contained tasks skip the planner", () => {
  for (const m of [
    "hi",
    "thanks!",
    "ok cool",
    "Write a short poem about Lagos rain",
    "Explain recursion like I'm five",
    "Translate this to French: good morning",
    "Refactor this function to async/await",
    "help me draft an email to my landlord",
    "Tell me about the Eiffel Tower",
  ]) {
    assert.equal(kind(m), "skip", m);
  }
});

test("time-sensitive, URL and factual questions go to the planner", () => {
  for (const m of [
    "What is the naira to dollar rate today?",
    "latest news on the Nigerian election",
    "Summarize https://example.com/post", // a URL beats the 'summarize' skip
    "Who won the 2026 World Cup?",
    "How many people live in Lagos?",
    "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much is the ball?",
    "What's the weather in Abuja",
  ]) {
    assert.equal(kind(m), "plan", m);
  }
});

test("bare arithmetic is calculated directly", () => {
  assert.deepEqual(routeAgent("17*23"), { kind: "calculate", expression: "17*23" });
  assert.deepEqual(routeAgent("what is 2^10?"), { kind: "calculate", expression: "2^10" });
  assert.deepEqual(routeAgent("calculate 1,200 x 3"), {
    kind: "calculate",
    expression: "1200 * 3",
  });
  assert.equal(kind("what is 42?"), "plan"); // a number, not a calculation
});

test("attachments and code skip the planner", () => {
  assert.equal(kind("what does this say?", { hasAttachments: true }), "skip");
  assert.equal(kind("why does this fail?\n```js\nfoo()\n```"), "skip");
});
