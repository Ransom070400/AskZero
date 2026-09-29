import test from "node:test";
import assert from "node:assert/strict";
import { prepareMathMarkdown as prep } from "../src/lib/markdown-math";

test("currency amounts are escaped so they don't pair into math", () => {
  assert.equal(
    prep("**$0.05** (the bat is $1.05, total $1.10)."),
    "**\\$0.05** (the bat is \\$1.05, total \\$1.10)."
  );
});

test("real inline and display math is left alone", () => {
  assert.equal(prep("Area is $\\pi r^2$ and $x^2$."), "Area is $\\pi r^2$ and $x^2$.");
  assert.equal(prep("$$\n1 + 1 = 2\n$$"), "$$\n1 + 1 = 2\n$$");
});

test("\\( \\) and \\[ \\] become remark-math delimiters", () => {
  assert.equal(prep("so \\(a+b\\) holds"), "so $a+b$ holds");
  assert.equal(prep("\\[E = mc^2\\]"), "$$E = mc^2$$");
});

test("code is untouched", () => {
  const md = "Price: $5\n\n```js\nconst s = `$${n}`; // $9\n```\nand `echo $1`";
  assert.equal(
    prep(md),
    "Price: \\$5\n\n```js\nconst s = `$${n}`; // $9\n```\nand `echo $1`"
  );
});

test("already-escaped dollars stay single-escaped", () => {
  assert.equal(prep("costs \\$3"), "costs \\$3");
});
