// Some models (e.g. MiniMax-M2.x on the 0G Router) put their reasoning inside
// the answer text as <think>…</think> instead of a separate reasoning field.
// ThinkSplitter routes streamed text into answer vs reasoning. Tags can be cut
// across chunk boundaries ("…<thi" + "nk>…"), so a possible partial tag at the
// end of a chunk is held back until the next chunk decides it.

const OPEN = "<think>";
const CLOSE = "</think>";

export interface SplitResult {
  content: string;
  reasoning: string;
}

export class ThinkSplitter {
  private inThink: boolean;
  private carry = "";
  private closed = false;

  // startInThink: for models that open their reasoning implicitly (no
  // <think>) and only close it — e.g. glm-5.1-fp8, which ignores
  // enable_thinking:false and streams "…reasoning…</think>answer".
  constructor(opts: { startInThink?: boolean } = {}) {
    this.inThink = opts.startInThink ?? false;
  }

  // Whether a </think> was ever seen. With startInThink, a stream that ends
  // without one never reasoned — its "reasoning" was really the answer.
  get sawClose(): boolean {
    return this.closed;
  }

  push(chunk: string): SplitResult {
    let text = this.carry + chunk;
    this.carry = "";
    const out: SplitResult = { content: "", reasoning: "" };

    while (text) {
      const tag = this.inThink ? CLOSE : OPEN;
      const at = text.indexOf(tag);
      if (at !== -1) {
        this.emit(out, text.slice(0, at));
        text = text.slice(at + tag.length);
        if (this.inThink) this.closed = true;
        this.inThink = !this.inThink;
        continue;
      }
      // No full tag: hold back the longest suffix that could start one.
      const hold = partialSuffix(text, tag);
      this.emit(out, text.slice(0, text.length - hold));
      this.carry = text.slice(text.length - hold);
      break;
    }
    return out;
  }

  // End of stream: whatever was held back was never a tag.
  flush(): SplitResult {
    const out: SplitResult = { content: "", reasoning: "" };
    this.emit(out, this.carry);
    this.carry = "";
    return out;
  }

  private emit(out: SplitResult, text: string) {
    if (this.inThink) out.reasoning += text;
    else out.content += text;
  }
}

// Length of the longest suffix of `text` that is a proper prefix of `tag`.
function partialSuffix(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}
