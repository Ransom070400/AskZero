import test from "node:test";
import assert from "node:assert/strict";
import { linkCitations } from "../src/lib/citations";

test("links bracketed numbers that have a source", () => {
  assert.equal(
    linkCitations("Rates rose [1][3]. Then fell [2].", 3),
    "Rates rose [1](#cite-1)[3](#cite-3). Then fell [2](#cite-2)."
  );
});

test("ignores numbers with no matching source", () => {
  assert.equal(linkCitations("See [4].", 3), "See [4].");
  assert.equal(linkCitations("See [1].", 0), "See [1].");
});

test("leaves code, indexing, links and definitions alone", () => {
  assert.equal(linkCitations("```js\nx = [1]\n```", 3), "```js\nx = [1]\n```");
  assert.equal(linkCitations("use `arr [1]` here [1]", 3), "use `arr [1]` here [1](#cite-1)");
  assert.equal(linkCitations("a[1] and b [2]", 3), "a[1] and b [2](#cite-2)");
  assert.equal(linkCitations("[1](https://x.com)", 3), "[1](https://x.com)");
  assert.equal(linkCitations("[1]: https://x.com", 3), "[1]: https://x.com");
});
