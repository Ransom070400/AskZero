import { visit } from "unist-util-visit";

// Turns `:::details[Summary]` (or `:::details{title="Summary"}`) container
// directives into a native <details><summary>…</summary>…</details> — a
// collapsible section with no raw HTML (so no rehype-raw / XSS surface).
// Runs after remark-directive, which parses the `:::` syntax.
//
// Usage in model output:
//   :::details[Show the full derivation]
//   ...markdown content...
//   :::
export function remarkDetails() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, (node: any) => {
      if (node.type !== "containerDirective" || node.name !== "details") return;

      const data = node.data || (node.data = {});
      const attrs = node.attributes || {};

      // Summary text: from the [label] (a directiveLabel paragraph) or {title=…}.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let summaryChildren: any[] = [
        { type: "text", value: attrs.title || "Details" },
      ];
      const labelIdx = node.children.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.data && c.data.directiveLabel
      );
      if (labelIdx !== -1) {
        summaryChildren = node.children[labelIdx].children;
        node.children.splice(labelIdx, 1);
      }

      node.children.unshift({
        type: "paragraph",
        data: { hName: "summary" },
        children: summaryChildren,
      });
      data.hName = "details";
      data.hProperties = { className: "md-details" };
    });
  };
}
