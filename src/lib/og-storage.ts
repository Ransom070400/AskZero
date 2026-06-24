// 0G Storage client — durable, content-addressed blob store.
//
// Used as the canonical store-of-record for the memory layer: we serialize a
// memory commit ({ memories, chat }) to JSON and upload it here, getting back
// a content-addressed root hash. Postgres keeps a searchable mirror; 0G holds
// the provable original.
//
// Node-only (the SDK uses node:fs). Import from server routes, never the edge
// runtime or the client. Every call is best-effort: storage being unavailable
// (no key, network, fees) must never break the chat path, so failures return
// null and the caller proceeds without an anchor.

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ethers } from "ethers";

const STORAGE_RPC_URL =
  process.env.ZERO_G_STORAGE_RPC_URL ??
  process.env.ZERO_G_CHAIN_RPC_URL ??
  process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ??
  "https://evmrpc-testnet.0g.ai";

const INDEXER_URL =
  process.env.ZERO_G_STORAGE_INDEXER_URL ??
  "https://indexer-storage-testnet-turbo.0g.ai";

// Storage uploads cost gas + a small fee, so they need a funded signer.
// Falls back to the shared 0G wallet used elsewhere.
function storageKey(): string | undefined {
  return process.env.ZERO_G_STORAGE_PRIVATE_KEY ?? process.env.ZERO_G_PRIVATE_KEY;
}

export function isStorageConfigured(): boolean {
  return Boolean(storageKey());
}

export interface PutResult {
  rootHash: string;
  txHash: string | null;
}

// Upload raw bytes to 0G Storage. Returns the content-addressed root hash
// (same bytes always yield the same hash) or null on any failure.
export async function putBlob(data: Uint8Array): Promise<PutResult | null> {
  const key = storageKey();
  if (!key) return null;

  try {
    // Dynamic import keeps the Node-only SDK out of any accidental edge bundle.
    const { Indexer, MemData } = await import("@0glabs/0g-ts-sdk");

    const provider = new ethers.JsonRpcProvider(STORAGE_RPC_URL);
    const signer = new ethers.Wallet(key, provider);
    const indexer = new Indexer(INDEXER_URL);

    const file = new MemData(data);
    // ethers v6 ESM/CJS dual-package hazard: our Wallet (ESM build) is
    // nominally distinct from the Signer the SDK's CJS .d.ts expects, though
    // identical at runtime. Cast to the method's own parameter type.
    const signerArg = signer as unknown as Parameters<typeof indexer.upload>[2];
    const [res, err] = await indexer.upload(file, STORAGE_RPC_URL, signerArg);
    if (err !== null || !res) {
      console.error("0G Storage upload failed:", err);
      return null;
    }
    return { rootHash: res.rootHash, txHash: res.txHash ?? null };
  } catch (err) {
    console.error("0G Storage upload threw:", err);
    return null;
  }
}

export async function putJSON(obj: unknown): Promise<PutResult | null> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return putBlob(bytes);
}

// Download bytes by root hash. The SDK writes to a file path, so we stage a
// temp file and read it back. Returns null on failure.
export async function getBlob(rootHash: string): Promise<Uint8Array | null> {
  try {
    const { Indexer } = await import("@0glabs/0g-ts-sdk");
    const indexer = new Indexer(INDEXER_URL);

    const outPath = join(tmpdir(), `0g-${randomUUID()}`);
    const err = await indexer.download(rootHash, outPath, true);
    if (err !== null) {
      console.error("0G Storage download failed:", err);
      return null;
    }
    try {
      const buf = await fs.readFile(outPath);
      return new Uint8Array(buf);
    } finally {
      await fs.unlink(outPath).catch(() => {});
    }
  } catch (err) {
    console.error("0G Storage download threw:", err);
    return null;
  }
}

export async function getJSON<T = unknown>(rootHash: string): Promise<T | null> {
  const bytes = await getBlob(rootHash);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}
