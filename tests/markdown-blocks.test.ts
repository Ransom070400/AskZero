import test from "node:test";
import assert from "node:assert/strict";
import { splitMarkdownBlocks } from "../src/lib/markdown-blocks";

test("splits paragraphs at blank lines", () => {
  assert.deepEqual(splitMarkdownBlocks("one\n\ntwo\n\n\nthree"), ["one", "two", "three"]);
});

test("keeps fenced code with blank lines together", () => {
  const md = "intro\n\n```js\na();\n\nb();\n```\n\nafter";
  assert.deepEqual(splitMarkdownBlocks(md), ["intro", "```js\na();\n\nb();\n```", "after"]);
});

test("an unclosed fence (still streaming) stays one block", () => {
  const md = "intro\n\n```py\nx = 1\n\ny = 2";
  assert.deepEqual(splitMarkdownBlocks(md), ["intro", "```py\nx = 1\n\ny = 2"]);
});

test("keeps $$ math and ::: containers together", () => {
  assert.deepEqual(splitMarkdownBlocks("$$\na\n\nb\n$$\n\nz"), ["$$\na\n\nb\n$$", "z"]);
  assert.deepEqual(splitMarkdownBlocks(":::note\na\n\nb\n:::\n\nz"), [":::note\na\n\nb\n:::", "z"]);
});

test("indented continuation stays with its list item", () => {
  const md = "- item\n\n  more about item\n- next\n\nafter";
  assert.deepEqual(splitMarkdownBlocks(md), ["- item\n\n  more about item\n- next", "after"]);
});

test("rejoined blocks round-trip the content", () => {
  const md = "# Title\n\nPara one.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n1. x\n2. y";
  assert.equal(splitMarkdownBlocks(md).join("\n\n"), md);
});

test("empty input gives one empty block", () => {
  assert.deepEqual(splitMarkdownBlocks(""), [""]);
});
