// Split markdown into independently renderable blocks, so a streaming answer
// can memoise every finished block and only re-parse the one still growing
// (re-parsing the whole answer on every token is O(n²) and stalls long ones).
//
// Splits only at a blank line that is outside a fenced code block, a $$ math
// block or a ::: directive container, and only when the next line starts at
// column 0 — an indented line after a blank one continues the previous list
// item, and parsed alone it would turn into a code block.
export function splitMarkdownBlocks(md: string): string[] {
  const lines = md.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null; // the ``` / ~~~ run that opened a code block
  let inMath = false;
  let directiveDepth = 0;
  let pendingBlank = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const inside = fence !== null || inMath || directiveDepth > 0;

    if (!inside && trimmed === "") {
      pendingBlank = true;
      current.push(line);
      continue;
    }
    if (pendingBlank && !inside && current.length > 0 && !/^\s/.test(line)) {
      // Drop the separating blank lines from the finished block.
      while (current.length > 0 && current[current.length - 1].trim() === "") {
        current.pop();
      }
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [];
    }
    pendingBlank = false;
    current.push(line);

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence !== null) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length && trimmed.slice(fenceMatch[1].length).trim() === "") {
        fence = null;
      }
    } else if (fenceMatch) {
      fence = fenceMatch[1];
    } else if (trimmed === "$$") {
      inMath = !inMath;
    } else if (!inMath && /^:::\s*\S/.test(trimmed)) {
      directiveDepth++;
    } else if (!inMath && directiveDepth > 0 && /^:::\s*$/.test(trimmed)) {
      directiveDepth--;
    }
  }

  if (current.length > 0) {
    const tail = current.join("\n");
    if (tail.trim() || blocks.length === 0) blocks.push(tail);
  }
  return blocks;
}
