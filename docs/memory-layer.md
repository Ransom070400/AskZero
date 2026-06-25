# Memory Layer (0G Storage + semantic recall)

Long-term, cross-chat memory for AskZero. The assistant remembers durable
facts about a user across all their chats, and every memory is backed by a
verifiable, content-addressed blob on **0G Storage**.

## How it works

```
recall (before inference)
  user message ──▶ embed ──▶ match_memories (pgvector) ──▶ top-K facts
                                                        └─▶ injected into system prompt

commit (after the reply, within the request)
  exchange ──▶ distill durable facts (LLM)
            ──▶ { memories, transcript } ──▶ 0G Storage (one blob ⇒ rootHash)
            ──▶ mirror facts into Postgres (content + embedding + rootHash)
```

- **0G Storage is the store-of-record.** One blob per commit holds *both* the
  distilled memories and the full transcript — so "long-term memory" and
  "verifiable archive" are satisfied by a single upload.
- **Postgres is the searchable index** (rebuildable from 0G). Recall hits
  Postgres, so it's fast; the canonical copy and provenance live on 0G.
- **Everything is best-effort.** If storage or embeddings are unavailable, chat
  is never blocked — memory just degrades (see below).

## Components

| Piece | File |
|---|---|
| 0G Storage client (`putJSON`/`getJSON`) | `src/lib/og-storage.ts` |
| Embeddings (`embed`) | `src/lib/embeddings.ts` |
| Recall + distill + commit | `src/lib/memory.ts` |
| Wiring (recall + commit) | `src/app/api/chat/route.ts` |
| Schema + RPCs | `supabase/migrations/20260624000000_memory_layer.sql` |
| Keep SDK external to bundle | `next.config.mjs` |
| Dependency | `@0glabs/0g-ts-sdk@0.3.3` |

## Setup

### 1. Apply the migration
Runs `create extension vector` and creates `memories`, `chat_archives`, and the
`match_memories` / `record_memory` / `record_chat_archive` RPCs.

### 2. Environment (`.env.local`)
A ready-to-fill block is appended to `.env.local`. Summary:

| Var | Needed? | Notes |
|---|---|---|
| `ZERO_G_STORAGE_INDEXER_URL` | **Yes (mainnet)** | Code defaults to *testnet*. On mainnet set `https://indexer-storage-turbo.0g.ai`. |
| `ZERO_G_STORAGE_RPC_URL` | No | Falls back to `ZERO_G_CHAIN_RPC_URL`. |
| `ZERO_G_STORAGE_PRIVATE_KEY` | No | Falls back to `ZERO_G_PRIVATE_KEY`. Wallet **must be funded** — uploads cost gas + storage fee. |
| `MEMORY_MODEL` | No | Defaults to `glm-5.1-fp8` (your Integrate model). |
| `EMBEDDING_URL` / `_KEY` / `_MODEL` | For semantic search | Your 0G network has **no embedding model** — point at an external OpenAI-compatible provider. |

### 0G mainnet reference values
- EVM RPC: `https://evmrpc.0g.ai` · Chain ID: `16661`
- Storage indexer (turbo): `https://indexer-storage-turbo.0g.ai`
- Storage flow contract: `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526`

## ⚠️ The 1536-dimension constraint

The `memories.embedding` column is **`vector(1536)`** (see migration, and
`EMBEDDING_DIM` in `src/lib/embeddings.ts`). The embedding model **must output
1536 dims**:

- `text-embedding-3-small` → 1536 ✅
- `text-embedding-ada-002` → 1536 ✅
- `text-embedding-3-large` → 3072 ❌ (change the column to `vector(3072)` and
  `EMBEDDING_DIM` to match, then re-embed)

## Graceful degradation (what happens when something's missing)

| Missing | Behavior |
|---|---|
| No embedding provider | Memories still stored/recalled, but by **recency**, not similarity (`match_memories` falls back when the query vector is null). |
| 0G Storage unavailable / unfunded | Facts still mirror into Postgres with `og_root_hash = null`; no on-chain anchor that commit. |
| Distillation returns nothing | No 0G write at all that turn (cost control — we only upload when there are durable facts). |

## Cost & latency notes

- **Mainnet uploads cost real 0G** from the storage wallet. We upload **only
  when distillation finds durable facts**, not every message — but it's still
  real spend. Consider throttling commits (e.g. every N turns) if volume grows.
- **Recall adds one embedding round-trip** (~100–300 ms) before the first
  token, on text turns only (skipped for attachment-only messages).
- **Distillation is one extra LLM call per assistant message** (platform
  compute, not billed to the user), run after `[DONE]` so it doesn't affect
  perceived latency.

## Verifiability

Every memory row carries the `og_root_hash` of the blob it was committed in,
and `chat_archives` pins the same hash per chat. Because 0G Storage is
content-addressed, anyone can re-fetch the blob by its root hash and confirm the
stored memories/transcript are exactly what was committed — the same
"prove-it-yourself" property as the inference receipts.

## Possible next steps

- Settings UI to view / delete memories (`memories` already has a select + delete RLS policy).
- A reconciliation/rebuild job that restores the Postgres index from 0G blobs.
- Throttle or batch distillation to cut per-message cost.
- Revisit `vector(1536)` if you adopt a different embedding model.
