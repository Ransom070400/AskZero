import test from "node:test";
import assert from "node:assert/strict";
import { ThinkSplitter } from "../src/lib/think-split";

// Feed chunks through a fresh splitter and join what comes out.
function run(chunks: string[], opts?: { startInThink?: boolean }) {
  const s = new ThinkSplitter(opts);
  let content = "";
  let reasoning = "";
  for (const c of [...chunks.map((c) => s.push(c)), s.flush()]) {
    content += c.content;
    reasoning += c.reasoning;
  }
  return { content, reasoning };
}

test("plain text passes through untouched", () => {
  assert.deepEqual(run(["Hello ", "world"]), {
    content: "Hello world",
    reasoning: "",
  });
});

test("think block in one chunk is routed to reasoning", () => {
  assert.deepEqual(run(["<think>plan it</think>The answer."]), {
    content: "The answer.",
    reasoning: "plan it",
  });
});

test("tags split across chunk boundaries", () => {
  assert.deepEqual(
    run(["<thi", "nk>step one, ", "step two</th", "ink>Done", "."]),
    { content: "Done.", reasoning: "step one, step two" }
  );
});

test("a '<' that never becomes a tag is released as content", () => {
  assert.deepEqual(run(["a < b and x <th"]), {
    content: "a < b and x <th",
    reasoning: "",
  });
});

test("unclosed think at end of stream stays reasoning", () => {
  assert.deepEqual(run(["<think>still going"]), {
    content: "",
    reasoning: "still going",
  });
});

test("implicit open: reasoning until </think>, then the answer", () => {
  const s = new ThinkSplitter({ startInThink: true });
  const a = s.push("The user wants X. Let me ");
  const b = s.push("think.</thi");
  const c = s.push("nk>Lagos has ~15M people.");
  const d = s.flush();
  assert.equal(a.reasoning + b.reasoning + c.reasoning + d.reasoning, "The user wants X. Let me think.");
  assert.equal(a.content + b.content + c.content + d.content, "Lagos has ~15M people.");
  assert.equal(s.sawClose, true);
});

test("implicit open without a close is flagged (it was the answer)", () => {
  const s = new ThinkSplitter({ startInThink: true });
  s.push("Just the answer.");
  s.flush();
  assert.equal(s.sawClose, false);
});
