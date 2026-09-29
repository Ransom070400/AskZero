import test from "node:test";
import assert from "node:assert/strict";
import { ThinkSplitter } from "../src/lib/think-split";

// Feed chunks through a fresh splitter and join what comes out.
function run(chunks: string[]) {
  const s = new ThinkSplitter();
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
