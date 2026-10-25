import test from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import { remarkDetails } from "../src/lib/remark-details";

// Markdown → hast, the same stages the chat renderer runs.
async function toHast(md: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkDetails)
    .use(remarkRehype);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await processor.run(processor.parse(md))) as any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (node: any): string =>
  node.type === "text" ? node.value : (node.children ?? []).map(textOf).join("");

test("a [label] becomes the <summary> of a <details>", async () => {
  const tree = await toHast(":::details[Show work]\nbody text\n:::");
  const details = tree.children.find((n: { tagName?: string }) => n.tagName === "details");
  assert.ok(details, "renders a <details>");
  assert.match(String(details.properties.className), /md-details/);
  const [summary, ...rest] = details.children.filter(
    (n: { type: string }) => n.type === "element"
  );
  assert.equal(summary.tagName, "summary");
  assert.equal(textOf(summary), "Show work");
  assert.match(rest.map(textOf).join(""), /body text/);
  assert.doesNotMatch(rest.map(textOf).join(""), /Show work/, "label isn't repeated in the body");
});

test("{title=…} works as the summary too, with a default when neither is given", async () => {
  const titled = await toHast(':::details{title="Logs"}\nx\n:::');
  assert.equal(textOf(titled.children[0].children[0]), "Logs");
  const bare = await toHast(":::details\nx\n:::");
  assert.equal(textOf(bare.children[0].children[0]), "Details");
});

test("other container directives are left alone", async () => {
  const tree = await toHast(":::note\nx\n:::");
  assert.notEqual(tree.children[0]?.tagName, "details");
});
