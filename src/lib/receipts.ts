import {
  AbiCoder,
  hexlify,
  keccak256,
  randomBytes,
  toUtf8Bytes,
} from "ethers";
import type { ChatMessage } from "@/lib/og-compute";

export interface ReceiptInput {
  userId: string;
  chatId: string;
  messageId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCredits: number;
  teeAttestation: string | null;
  timestamp: number; // unix seconds
  nonce: string;     // 0x-prefixed 32-byte hex
}

export interface Receipt extends ReceiptInput {
  inputHash: string;
  outputHash: string;
  receiptHash: string;
}

// Cost is stored as numeric in the DB; we scale to integer hundredths
// for the on-chain commitment so the leaf can be verified with uint256 math.
const COST_SCALE = 100;

export function makeNonce(): string {
  return hexlify(randomBytes(32));
}

export function hashText(text: string): string {
  return keccak256(toUtf8Bytes(text));
}

// Canonicalize the message array before hashing so the same logical
// conversation always produces the same input_hash regardless of object
// key ordering or attachment shape.
export function hashMessages(messages: ChatMessage[]): string {
  const canonical = messages
    .map((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content
              .map((p) =>
                p.type === "text"
                  ? `T:${p.text}`
                  : `I:${p.image_url.url}`
              )
              .join("|");
      return `${m.role}\x1f${content}`;
    })
    .join("\x1e");
  return keccak256(toUtf8Bytes(canonical));
}

const RECEIPT_TYPES = [
  "string",  // userId
  "string",  // chatId
  "string",  // messageId
  "string",  // provider
  "string",  // model
  "bytes32", // inputHash
  "bytes32", // outputHash
  "uint256", // inputTokens
  "uint256", // outputTokens
  "uint256", // costCredits * COST_SCALE
  "string",  // teeAttestation (empty string when null)
  "uint256", // timestamp
  "bytes32", // nonce
];

export function hashReceipt(
  input: ReceiptInput & { inputHash: string; outputHash: string }
): string {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(RECEIPT_TYPES, [
    input.userId,
    input.chatId,
    input.messageId,
    input.provider,
    input.model,
    input.inputHash,
    input.outputHash,
    input.inputTokens,
    input.outputTokens,
    Math.round(input.costCredits * COST_SCALE),
    input.teeAttestation ?? "",
    input.timestamp,
    input.nonce,
  ]);
  return keccak256(encoded);
}

export function buildReceipt(
  input: ReceiptInput,
  messages: ChatMessage[],
  output: string
): Receipt {
  const inputHash = hashMessages(messages);
  const outputHash = hashText(output);
  const receiptHash = hashReceipt({ ...input, inputHash, outputHash });
  return { ...input, inputHash, outputHash, receiptHash };
}

// Sorted-pair Merkle tree (OpenZeppelin-compatible). Leaves should already
// be 0x-prefixed 32-byte hashes (i.e. receipt_hash values).
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    throw new Error("merkleRoot: no leaves");
  }
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : a;
      next.push(hashPair(a, b));
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: string[], index: number): string[] {
  if (index < 0 || index >= leaves.length) {
    throw new Error("merkleProof: index out of range");
  }
  const proof: string[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const pairIdx = idx ^ 1;
    proof.push(pairIdx < level.length ? level[pairIdx] : level[idx]);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : a;
      next.push(hashPair(a, b));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// Recompute the Merkle root a leaf + its proof imply. Lets us prove a single
// receipt is included in an anchored batch without trusting the stored root.
export function rootFromProof(leaf: string, proof: string[]): string {
  let h = leaf;
  for (const sibling of proof) {
    h = hashPair(h, sibling);
  }
  return h;
}

export function verifyProof(
  leaf: string,
  proof: string[],
  root: string
): boolean {
  return rootFromProof(leaf, proof).toLowerCase() === root.toLowerCase();
}

function hashPair(a: string, b: string): string {
  const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  const coder = AbiCoder.defaultAbiCoder();
  return keccak256(coder.encode(["bytes32", "bytes32"], [lo, hi]));
}
