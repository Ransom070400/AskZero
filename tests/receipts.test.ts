import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReceipt,
  hashMessages,
  hashText,
  merkleProof,
  merkleRoot,
  rootFromProof,
  verifyProof,
} from "../src/lib/receipts";

const nonce =
  "0x0000000000000000000000000000000000000000000000000000000000000042";

const baseInput = {
  userId: "user_1",
  chatId: "chat_1",
  messageId: "message_1",
  provider: "integrate:glm-5.1",
  model: "glm-5.1-fp8",
  inputTokens: 17,
  outputTokens: 29,
  costCredits: 1.25,
  teeAttestation: null,
  timestamp: 1_800_000_000,
  nonce,
};

const messages = [
  { role: "system" as const, content: "Be concise." },
  { role: "user" as const, content: "What is AskZero?" },
];

test("buildReceipt creates stable hashes for the same transcript and output", () => {
  const first = buildReceipt(baseInput, messages, "AskZero is verifiable AI.");
  const second = buildReceipt(baseInput, messages, "AskZero is verifiable AI.");

  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.outputHash, second.outputHash);
  assert.equal(first.receiptHash, second.receiptHash);
});

test("receipt hash changes when the answer changes", () => {
  const original = buildReceipt(baseInput, messages, "Original answer");
  const tampered = buildReceipt(baseInput, messages, "Tampered answer");

  assert.notEqual(original.outputHash, tampered.outputHash);
  assert.notEqual(original.receiptHash, tampered.receiptHash);
});

test("hashMessages canonicalizes multimodal content deterministically", () => {
  const multimodal = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: "Describe this" },
        {
          type: "image_url" as const,
          image_url: { url: "https://example.com/image.png" },
        },
      ],
    },
  ];

  assert.equal(hashMessages(multimodal), hashMessages(multimodal));
  assert.notEqual(hashMessages(messages), hashMessages(multimodal));
});

test("merkle proof reconstructs and verifies the anchored root", () => {
  const leaves = ["alpha", "beta", "gamma", "delta"].map(hashText);
  const root = merkleRoot(leaves);
  const proof = merkleProof(leaves, 2);

  assert.equal(rootFromProof(leaves[2], proof), root);
  assert.equal(verifyProof(leaves[2], proof, root), true);
  assert.equal(verifyProof(hashText("tampered"), proof, root), false);
});

test("merkleRoot rejects empty batches", () => {
  assert.throws(() => merkleRoot([]), /no leaves/);
});
