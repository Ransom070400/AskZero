import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createTokenBatcher, readSSE } from "../src/lib/chat-stream";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(chunks: string[]) {
  const events: unknown[] = [];
  await readSSE(streamOf(chunks), (e) => events.push(e));
  return events;
}

test("parses data frames, skipping [DONE] and malformed ones", async () => {
  assert.deepEqual(
    await collect(['data: {"a":1}\n\n', "data: nope\n\n", 'data: {"b":2}\n\ndata: [DONE]\n\n']),
    [{ a: 1 }, { b: 2 }]
  );
});

test("reassembles frames split across chunks", async () => {
  assert.deepEqual(await collect(['data: {"te', 'xt":"hi"}\n', "\n"]), [{ text: "hi" }]);
});

test("keeps a final frame the stream closed on without a blank line", async () => {
  assert.deepEqual(await collect(['data: {"a":1}\n\ndata: {"b":2}']), [{ a: 1 }, { b: 2 }]);
});

test("reassembles multi-byte characters split across chunks", async () => {
  const bytes = new TextEncoder().encode('data: {"t":"₦"}\n\n');
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 13));
      c.enqueue(bytes.slice(13));
      c.close();
    },
  });
  const events: unknown[] = [];
  await readSSE(stream, (e) => events.push(e));
  assert.deepEqual(events, [{ t: "₦" }]);
});

test("token batcher coalesces pushes into one apply per interval", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const calls: [string, string][] = [];
    const b = createTokenBatcher((c, r) => calls.push([c, r]), 32);
    b.push({ content: "Hel" });
    b.push({ content: "lo", reasoning: "hm" });
    assert.equal(calls.length, 0);
    mock.timers.tick(32);
    assert.deepEqual(calls, [["Hello", "hm"]]);
    b.flush();
    assert.equal(calls.length, 1, "an empty flush applies nothing");
    b.push({ content: "!" });
    b.flush();
    assert.deepEqual(calls[1], ["!", ""]);
    mock.timers.tick(100);
    assert.equal(calls.length, 2, "flush cancels the pending timer");
  } finally {
    mock.timers.reset();
  }
});
