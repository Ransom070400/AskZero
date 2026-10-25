import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, CHAT_STYLES, type ChatStyle } from "../src/lib/system-prompt";

test("default style is the base prompt alone", () => {
  assert.equal(buildSystemPrompt(), buildSystemPrompt("default"));
  assert.doesNotMatch(buildSystemPrompt(), /^Style:/m);
});

test("every non-default style appends its overlay", () => {
  const base = buildSystemPrompt();
  for (const { id } of CHAT_STYLES.filter((s) => s.id !== "default")) {
    const prompt = buildSystemPrompt(id);
    assert.ok(prompt.startsWith(base), id);
    assert.match(prompt.slice(base.length), /^\n\nStyle: /, id);
  }
});

test("an unknown style from the request falls back to the base prompt", () => {
  for (const bogus of ["shouty", "toString", ""]) {
    const prompt = buildSystemPrompt(bogus as ChatStyle);
    assert.equal(prompt, buildSystemPrompt(), bogus);
    assert.doesNotMatch(prompt, /undefined/);
  }
});
