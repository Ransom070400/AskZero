import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { fetchUrlTool } from "../src/lib/tools";

test("rejects non-http and private addresses before fetching", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("x"));
  try {
    for (const url of [
      "ftp://example.com",
      "not a url",
      "http://localhost:3000/api",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.20.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://printer.local/",
    ]) {
      await assert.rejects(fetchUrlTool(url), Error, url);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
  }
});

test("public hosts that merely look similar are allowed", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("ok"));
  try {
    for (const url of ["https://172.15.0.1/", "https://local.example.com/", "https://10.com/"]) {
      assert.equal(await fetchUrlTool(url), "ok", url);
    }
  } finally {
    fetchMock.mock.restore();
  }
});

test("returns the page's visible text, without scripts or styles", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response(
      "<html><style>p{}</style><script>evil()</script><p>Hello</p>  <b>world</b></html>"
    )
  );
  try {
    assert.equal(await fetchUrlTool("https://example.com"), "Hello world");
  } finally {
    fetchMock.mock.restore();
  }
});

test("surfaces non-OK responses as errors", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response("nope", { status: 404 })
  );
  try {
    await assert.rejects(fetchUrlTool("https://example.com/missing"), /fetch 404/);
  } finally {
    fetchMock.mock.restore();
  }
});
