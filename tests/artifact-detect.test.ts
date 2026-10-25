import test from "node:test";
import assert from "node:assert/strict";
import { detectArtifacts } from "../src/lib/artifact-detect";

const fence = (lang: string, lines: string[]) =>
  "```" + lang + "\n" + lines.join("\n") + "\n```";

const nLines = (n: number, prefix = "x") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test("empty or fence-free content has no artifacts", () => {
  assert.deepEqual(detectArtifacts(""), []);
  assert.deepEqual(detectArtifacts("just prose"), []);
});

test("mermaid needs at least 5 lines", () => {
  assert.equal(detectArtifacts(fence("mermaid", nLines(4))).length, 0);
  const [a] = detectArtifacts(fence("mermaid", nLines(5)));
  assert.equal(a.type, "mermaid");
});

test("code needs at least 30 lines and is titled from its first declaration", () => {
  assert.equal(detectArtifacts(fence("ts", nLines(29))).length, 0);
  const [a] = detectArtifacts(
    fence("ts", ["function buildIndex() {", ...nLines(29)])
  );
  assert.equal(a.type, "code");
  assert.equal(a.title, "buildIndex");
  assert.equal(a.language, "ts");
});

test("untitled code falls back to the language name", () => {
  const [a] = detectArtifacts(fence("py {1,2}", nLines(30)));
  assert.equal(a.title, "PY snippet");
  assert.equal(a.language, "py");
});

test("markdown blocks never become code artifacts", () => {
  assert.equal(detectArtifacts(fence("md", nLines(40))).length, 0);
});

test("html is detected by tag or doctype and titled from <title>", () => {
  const [byLang] = detectArtifacts(
    fence("html", ["<html><head><title> Hi </title></head></html>"])
  );
  assert.equal(byLang.type, "html");
  assert.equal(byLang.title, "Hi");
  const [byDoctype] = detectArtifacts(fence("", ["<!DOCTYPE html>", "<p/>"]));
  assert.equal(byDoctype.type, "html");
  assert.equal(byDoctype.title, "HTML document");
});

test("svg is detected by tag or root element", () => {
  assert.equal(detectArtifacts(fence("", ["<svg viewBox='0 0 1 1'/>"]))[0].type, "svg");
  assert.equal(detectArtifacts(fence("svg", ["<g/>"]))[0].type, "svg");
});

test("jsx/tsx needs React hints to be a react artifact", () => {
  const [a] = detectArtifacts(
    fence("react", ["export default function App() {", "  return <Card/>;", "}"])
  );
  assert.equal(a.type, "react");
  assert.equal(a.language, "tsx");
  assert.equal(detectArtifacts(fence("tsx", ["const x = 1;"])).length, 0);
});
