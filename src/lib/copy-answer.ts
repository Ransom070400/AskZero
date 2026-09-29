// Copying a rendered answer so it pastes well everywhere:
//  · text/html  → Google Docs, Word, Notion, email keep headings, lists,
//                 bold and tables.
//  · text/plain → WhatsApp, SMS, plain editors get clean readable text:
//                 "• " bullets, "1." numbers, tables as "a | b", no ** or #.
// UI chrome inside the answer (code-block toolbars, line numbers, per-table
// buttons) is marked data-copy-skip and left out; math is copied as its TeX.

const BLOCK_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "DIV", "SECTION",
  "DETAILS", "SUMMARY", "FIGURE",
]);

function cleanClone(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-copy-skip]").forEach((n) => n.remove());
  // KaTeX renders MathML + styled HTML; neither pastes sensibly. Use the TeX.
  clone.querySelectorAll(".katex").forEach((k) => {
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent;
    const display = k.closest(".katex-display");
    const replacement = document.createTextNode(
      tex ? (display ? `$$${tex}$$` : `$${tex}$`) : k.textContent ?? ""
    );
    (display ?? k).replaceWith(replacement);
  });
  // Drop presentation-only attributes so pasted HTML takes the target's styles.
  clone.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("class");
    el.removeAttribute("style");
  });
  return clone;
}

function tableToRows(table: HTMLTableElement): string[][] {
  return Array.from(table.rows).map((r) =>
    Array.from(r.cells).map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())
  );
}

function toPlain(node: Node, depth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const inner = () =>
    Array.from(el.childNodes).map((c) => toPlain(c, depth)).join("");

  switch (el.tagName) {
    case "BR":
      return "\n";
    case "HR":
      return "\n\n";
    case "PRE":
      return `\n\n${(el.textContent ?? "").replace(/\n$/, "")}\n\n`;
    case "UL":
    case "OL": {
      const ordered = el.tagName === "OL";
      const start = Number(el.getAttribute("start") ?? 1);
      const items = Array.from(el.children).filter((c) => c.tagName === "LI");
      const lines = items.map((li, i) => {
        const marker = ordered ? `${start + i}. ` : "• ";
        const body = Array.from(li.childNodes)
          .map((c) => toPlain(c, depth + 1))
          .join("")
          .trim()
          .replace(/\n{2,}/g, "\n");
        return "  ".repeat(depth) + marker + body;
      });
      return `\n${lines.join("\n")}\n`;
    }
    case "TABLE":
      return `\n\n${tableToRows(el as HTMLTableElement)
        .map((row) => row.join(" | "))
        .join("\n")}\n\n`;
    default:
      return BLOCK_TAGS.has(el.tagName) ? `\n\n${inner()}\n\n` : inner();
  }
}

async function writeClipboard(html: string, text: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // Some browsers refuse rich writes — fall back to plain text.
    }
  }
  await navigator.clipboard.writeText(text);
}

function plainFrom(clone: HTMLElement): string {
  return toPlain(clone)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Formatted (HTML) + readable plain text in one clipboard write.
export async function copyAnswer(root: HTMLElement): Promise<void> {
  const clone = cleanClone(root);
  await writeClipboard(clone.innerHTML, plainFrom(clone));
}

// Plain text only — for pasting where formatting would get in the way.
export async function copyAnswerPlain(root: HTMLElement): Promise<void> {
  await navigator.clipboard.writeText(plainFrom(cleanClone(root)));
}

// One table: HTML for Docs, tab-separated for Sheets/Excel (pastes as cells).
export async function copyTable(table: HTMLTableElement): Promise<void> {
  const clone = cleanClone(table);
  const tsv = tableToRows(table)
    .map((row) => row.join("\t"))
    .join("\n");
  await writeClipboard(clone.outerHTML, tsv);
}
