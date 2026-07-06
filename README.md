# AskZero

**Verifiable AI chat, pay-as-you-go.** AskZero is a decentralized AI chat product built on [0G (Zero Gravity)](https://0g.ai). Every answer is fingerprinted into a cryptographic **inference receipt**, Merkle-batched, and anchored on the 0G chain — so a response can be **independently verified**, not just trusted. Long-term memory is archived to **0G Storage**, and usage is billed per message from a prepaid credit balance with **no subscriptions**.

> The one thing a ChatGPT clone can't do: prove the answer you got is the answer that was produced.

---

## Why it's different

Most AI apps ask you to trust that the model said what the UI shows. AskZero makes that checkable:

- 🧾 **Verifiable receipts** — each answer commits a keccak256 receipt (hashes of the exact input and output). Receipts are Merkle-batched and the root is anchored on-chain. In the app you can **re-derive the Merkle root from your receipt + proof and confirm it live via the registry's `isAnchored()`** — tamper-evidence you can watch happen.
- 🧠 **On-chain memory** — durable facts are embedded for fast recall *and* archived to 0G Storage, so the memory behind your answers is content-addressed and durable, not a black box.
- 💳 **Real pay-as-you-go billing** — metered credits with transparent, dynamic pricing (see [Billing](#billing--pricing)). No plans, no seats, no lock-in.
- 📱 **Web + native mobile** — a Next.js web app and a React Native (Expo) iOS/Android app sharing one backend.

---

## Features

- **Streaming chat** — SSE, conversation history with auto-titling, selectable answer styles (default / concise / explanatory / code), and a live "thinking" trace for tool/agent steps.
- **Autonomous research** — multi-source web research that reads, cross-checks, and returns a cited report.
- **Vision & file input** — image attachments (multimodal) and PDF text extraction.
- **Voice input** — in-browser / on-device recording → Whisper transcription.
- **Image generation** — natural-language intent detection routes "draw/generate…" prompts to a text-to-image model.
- **Artifacts** — long code, HTML, SVG, Mermaid, and live React components open in a side panel with version history.
- **Long-term memory** — distilled, embedded for semantic recall, archived to 0G Storage.
- **Verifiable receipts** — per-message, anchored on-chain, verifiable in the UI.
- **Incognito mode** — ephemeral chats that aren't saved, aren't remembered, and skip the memory layer entirely.
- **Credits & billing** — Paystack (NGN), Stripe (USD + 13 APAC currencies), and **Pay with 0G** (connect a wallet, pay in 0G tokens on-chain).
- **Auth** — Supabase email/password and Google OAuth (web + mobile).

---

## Verifiable receipts

This is the core differentiator, so it's worth being precise about what is and isn't on-chain:

1. On each answer, AskZero computes `receiptHash = keccak256(input_hash, output_hash, model, tokens, …)` — the Merkle **leaf**.
2. An hourly job Merkle-batches pending receipts and calls `postRoot(root, …)` on the `ReceiptRegistry` contract. **Only the batch's Merkle root is stored on-chain — individual receipts are not.**
3. Anyone holding a receipt can prove inclusion: recompute the root from the receipt hash + its sibling proof and check it against the anchored root, then confirm that root via the registry's on-chain `isAnchored()` view.

The app does exactly this from the receipt panel on every message (web and mobile): it re-derives the root, checks it against the chain the batch was anchored on, and links to the correct explorer. Altering a single character of an answer changes its hash, breaks the proof, and fails the on-chain check.

> Note: the anchoring **target chain is configurable per environment**. The registry is deployed on 0G mainnet at `0xb803E353E69F4B848a82efaaa21052808c3052eF` (chain `16661`); some environments anchor to 0G Galileo testnet (`16602`). The UI derives the explorer and RPC from the chain each batch was actually anchored on, and labels the network honestly.

---

## Billing & pricing

Pay-as-you-go credits, priced so margins can't invert when the underlying token moves.

- **Unit** — **1,000 credits = $1** (1 credit = 0.1¢). Balances render in the user's chosen currency.
- **Metering** — every message deducts credits for input + output tokens; image generation and research have their own costs. The exact cost is recorded on the receipt.
- **Dynamic pricing** — Integrate-model prices are computed as **wholesale × markup** (input 3.0×, output 2.0×), recomputed against the live 0G token price so a token-price swing can't push cost below wholesale. A static `MODEL_PRICING` table is the fallback.
- **Funding** — deposits via **Paystack** (NGN), **Stripe** (USD + 13 APAC currencies: JPY, SGD, HKD, AUD, NZD, MYR, THB, KRW, PHP, IDR, INR, VND, TWD), and **Pay with 0G**: connect a wallet (Reown AppKit / WalletConnect) and pay in 0G on-chain (`POST /api/deposit/crypto`).
- **Secure crypto deposits** — a 0G deposit is credited only after a **wallet-ownership signature** proves the caller sent the tx (so no one can claim a stray txHash), plus recipient / confirmation / idempotency checks. Amount is credited server-side from the on-chain value at the live 0G price.
- **No subscriptions** — no plans or seats; you spend what you top up.

---

## Architecture

```
   Client (Next.js web · Expo mobile)  ──▶  /api/chat
                                             ├─ recall memories (pgvector search)
                                             ├─ route by provider prefix:
                                             │    integrate:*  ─▶ 0G Integrate Network   (GLM 5.1, shipping)
                                             │    <address>    ─▶ 0G Compute broker       (on-chain settled)
                                             ├─ stream reply (SSE)
                                             ├─ deduct credits
                                             ├─ record inference receipt
                                             └─ commit memory ─▶ 0G Storage (rootHash)

   Supabase (Postgres · Auth · Storage)      0G chain
   ├─ profiles / chats / messages            ├─ ReceiptRegistry.sol (Merkle roots, notary)
   ├─ memories (pgvector) + archives         └─ hourly cron anchors pending receipts
   └─ inference_receipts / batches
```

### 0G integration surfaces

| Surface | Library | Role |
|---|---|---|
| **0G Integrate Network** | `src/lib/integrate-network.ts` | OpenAI-compatible, TEE-verified gateway for **GLM 5.1** — the shipping chat model. Dynamic wholesale pricing. |
| **0G Compute broker** | `src/lib/og-compute.ts`, `src/lib/og-compute-models.ts` | Fully on-chain-settled inference via `@0glabs/0g-serving-broker`. A curated, verified provider (GLM 5.1) is surfaced in the picker; broker auto-discovery stays curated (see [Notes](#implementation-notes)). |
| **0G Storage** | `src/lib/og-storage.ts` | Content-addressed blob store (`@0gfoundation/0g-storage-ts-sdk`) for memory archives. |
| **0G chain** | `src/lib/receipt-anchor.ts`, `contracts/ReceiptRegistry.sol` | Anchors Merkle roots of inference receipts. Mainnet registry `0xb803E353E69F4B848a82efaaa21052808c3052eF` (chain `16661`); target chain is env-configurable. |
| **0G token** | `src/lib/og-token.ts` | Spot price for fiat→credit and neuron→credit conversions. |

**Honest framing:** the model picker now includes a **verified 0G Compute broker model** (GLM 5.1, provider `0x7DCFe6…`) whose inference is **settled on-chain via the shared 0G ledger** and served by a decentralized provider — genuine 0G Compute, confirmed end-to-end (streaming + non-streaming) on mainnet. Most other chat models still run on the **0G Integrate Network** (a TEE-verified gateway) for reliability. Memory storage and receipt anchoring are also on 0G. Adding more broker providers is a curated, per-provider step (each provider's ledger sub-account must be funded first).

---

## Tech stack

- **Web** — Next.js 14 (App Router), React 18, TypeScript, Tailwind, framer-motion, three.js / r3f (landing).
- **Mobile** — React Native / Expo (SDK 54, new architecture), expo-router, shared backend via bearer-token API.
- **Backend** — Supabase (Postgres, Auth, Storage), `pgvector` for embeddings.
- **Chain** — ethers v6, `@0glabs/0g-serving-broker`, `@0gfoundation/0g-storage-ts-sdk`, `solc`.
- **Wallet** — Reown AppKit (Web3Modal) + WalletConnect via the ethers adapter (for Pay with 0G).
- **Payments** — Stripe, Paystack.
- **Content** — react-markdown, remark/rehype, KaTeX, highlight.js, mermaid, pdf-parse.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth + Storage)
- 0G Integrate Network credentials (for GLM 5.1)
- A 0G wallet funded with 0G for gas (storage uploads + receipt anchoring; also the compute ledger if you enable the broker)
- Stripe and/or Paystack keys for deposits

### 1. Install & configure

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

Key variables (full list in `.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase client + server |
| `INTEGRATE_NETWORK_URL` / `INTEGRATE_NETWORK_KEY` | GLM 5.1 chat, embeddings, Whisper |
| `ZERO_G_PRIVATE_KEY` / `ZERO_G_CHAIN_RPC_URL` | 0G wallet + EVM RPC (`https://evmrpc.0g.ai`) |
| `ZERO_G_STORAGE_INDEXER_URL` | 0G Storage indexer (mainnet: `https://indexer-storage-turbo.0g.ai`) |
| `NEXT_PUBLIC_ZERO_G_CHAIN_ID` / `NEXT_PUBLIC_ZERO_G_RPC_URL` / `NEXT_PUBLIC_ZERO_G_EXPLORER_URL` | Client chain config |
| `RECEIPT_REGISTRY_ADDRESS` / `RECEIPT_BATCHER_PRIVATE_KEY` / `CRON_SECRET` | Receipt anchoring (skipped if unset) |
| `Z_IMAGE_*` | Image generation (Z-Image; default 100 credits) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | NGN deposits |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | USD/APAC deposits |
| `NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS` / `DEPOSIT_WALLET_ADDRESS` | Destination wallet for **Pay with 0G** (client + server copies of the same address) |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown AppKit / WalletConnect project id (free at [dashboard.reown.com](https://dashboard.reown.com)) — enables the wallet chooser |
| `RESEND_API_KEY` / `EMAIL_FROM` / `ADMIN_EMAILS` | Email + admin allowlist (optional) |

### 2. Database

Apply the SQL migrations in `supabase/migrations/` (Supabase CLI or dashboard). They create the core tables, credit RPCs (`deduct_credits`, `add_credits`, `complete_deposit`), attachments, inference receipts + batches, artifacts, message search/edit branches, and the memory layer (`memories` with `pgvector`, `chat_archives`). Create a public Storage bucket named `chat-attachments`.

### 3. One-time 0G setup (optional — on-chain paths)

```bash
npx tsx scripts/setup-0g.ts                                  # init shared 0G Compute ledger
npx tsx scripts/topup-provider.ts <providerAddress> <0G>     # fund a provider sub-account
npm run deploy:registry -- --poster=<batcherAddress>         # deploy ReceiptRegistry
```

### 4. Run

```bash
npm run dev            # web → http://localhost:3000
cd mobile && npx expo start   # mobile
```

### 5. Receipt anchoring (production)

`vercel.json` registers an hourly Vercel Cron hitting `GET /api/cron/anchor-receipts` (authorized via `CRON_SECRET`), which batches pending receipts and anchors their Merkle root. Keep the batcher wallet funded with 0G for gas.

---

## Models

| Model | Type | How it's served |
|---|---|---|
| **GLM 5.1** (`glm-5.1` → `glm-5.1-fp8`) | Chat | 0G Integrate Network — "Zhipu · TEE-verified". Reasoning tokens disabled so content streams visibly. |
| **Z-Image Turbo** | Image generation | OpenAI-compatible endpoint |
| Whisper (`whisper-large-v3`) | Speech-to-text | Integrate Network (internal) |
| `text-embedding-3-small` | Embeddings | Integrate Network (powers memory recall) |

Chat routing dispatches on the `provider` prefix: `integrate:*` → Integrate Network; a provider address → 0G Compute broker.

---

## Implementation notes

Kept current for accuracy — these are real, deliberate gaps:

- **0G Compute broker — one curated model is live in the picker** (`src/lib/og-compute-models.ts`). Full `listService()` auto-discovery is still intentionally *not* surfaced (providers vary in reliability/pricing). To add a provider: fund its ledger sub-account (`broker.ledger.depositFund` / transfer-fund), smoke-test it, then add it to the curated list. Keep the shared ledger topped up — `getRequestHeaders` auto-funds provider sub-accounts and fails if the available balance is too low.
- **Pay with 0G is web-only** for now (Reown AppKit + injected/WalletConnect wallets). A mobile 0G-pay flow (WalletConnect deep-linking) is a separate build; mobile ships Paystack + Stripe.
- **Per-user on-chain ledgers** are designed (`docs/per-user-0g-ledgers-plan.md`) but not implemented; a single shared 0G ledger is used.

---

## License

[MIT](./LICENSE) © 2026 Eze Ransom. The `package.json` keeps `"private": true` to prevent accidental npm publish; the source is MIT-licensed.

```
askzero · built on 0G
```
