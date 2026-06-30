# AskZero

**Private, verifiable AI. No subscriptions.** AskZero is a decentralized AI chat application built on [0G (Zero Gravity)](https://0g.ai). Inference runs on 0G's decentralized compute network, long-term memory is archived to 0G Storage, and every response is committed to a cryptographic receipt that is Merkle-batched and anchored on the 0G chain — so answers are provable, not just promised.

> the future of ai is decentralized.

---

## What it is

A full-featured, credits-based AI chat product (think a ChatGPT-style app) where the AI backend, the memory store, and the audit trail all live on 0G infrastructure instead of a centralized provider. Users top up a credit balance with fiat and spend it per message; there are no subscriptions.

### Core capabilities

- **Streaming chat** — Server-Sent Events, conversation history with auto-titling, four selectable answer styles (default / concise / explanatory / code).
- **Vision & file input** — image attachments (OpenAI-style multimodal) and PDF text extraction inlined into the prompt.
- **Voice input** — in-browser recording → WAV → Whisper transcription.
- **Image generation** — natural-language intent detection routes "draw/generate an image of…" prompts to a text-to-image model.
- **Artifacts** — long code, HTML, SVG, Mermaid diagrams, and live React components are promoted to a side panel with version history.
- **Long-term memory** — durable facts about the user are distilled, embedded for semantic recall, and archived to 0G Storage.
- **Inference receipts** — each message produces a keccak256 receipt anchored on-chain in Merkle batches.
- **Credits & billing** — pay-as-you-go credits funded via Paystack (NGN) and Stripe (USD + APAC currencies).
- **Auth** — Supabase email/password and Google OAuth.

---

## Architecture

```
                          ┌──────────────────────────────────────────┐
   Browser (Next.js)  ───▶ │  /api/chat                                │
                          │   ├─ recall memories (vector search)       │
                          │   ├─ route by provider prefix:             │
                          │   │    integrate:* ─▶ 0G Integrate Network  │  ← GLM 5.1 (TEE-verified)
                          │   │    else        ─▶ 0G Compute broker     │  ← on-chain settled inference
                          │   ├─ stream reply (SSE)                     │
                          │   ├─ deduct credits                         │
                          │   ├─ record inference receipt               │
                          │   └─ commit memory ─▶ 0G Storage (rootHash) │
                          └──────────────────────────────────────────┘
                                       │
   Supabase (Postgres + Auth + Storage)│   0G chain
   ├─ profiles / chats / messages      │   ├─ ReceiptRegistry.sol  (Merkle roots, notary)
   ├─ memories (pgvector) + archives   │   └─ cron anchors pending receipts hourly
   └─ inference_receipts / batches     │
```

**0G integration surfaces:**

| Surface | Library | Role |
|---|---|---|
| **0G Integrate Network** | `src/lib/integrate-network.ts` | OpenAI-compatible proxy for GLM 5.1 (the shipping chat model). Dynamic wholesale pricing. |
| **0G Compute broker** | `src/lib/og-compute.ts` | On-chain-settled inference via `@0glabs/0g-serving-broker`. Implemented; not surfaced in the model picker (see [Notes](#implementation-notes)). |
| **0G Storage** | `src/lib/og-storage.ts` | Content-addressed blob store (`@0gfoundation/0g-storage-ts-sdk`) for memory archives. |
| **0G chain** | `src/lib/receipt-anchor.ts`, `contracts/ReceiptRegistry.sol` | Anchors Merkle roots of inference receipts. Live mainnet registry: `0xb803E353E69F4B848a82efaaa21052808c3052eF` (chain ID `16661`). |
| **0G token** | `src/lib/og-token.ts` | Spot price for fiat→credit and neuron→credit conversions. |

---

## Tech stack

- **Framework** — Next.js 14 (App Router), React 18, TypeScript
- **Styling** — Tailwind CSS, shadcn-style primitives, framer-motion, three.js / react-three-fiber (landing visuals)
- **Backend** — Supabase (Postgres, Auth, Storage), `pgvector` for embeddings
- **Chain** — ethers v6, `@0glabs/0g-serving-broker`, `@0gfoundation/0g-storage-ts-sdk`, `solc` (contract compile/deploy)
- **Payments** — Stripe, Paystack (`react-paystack`)
- **Content** — react-markdown, remark/rehype, KaTeX (math), highlight.js (code), mermaid (diagrams), pdf-parse
- **Email** — Resend (optional)

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth + Storage)
- A 0G wallet funded with 0G for gas (compute ledger, storage uploads, receipt anchoring)
- 0G Integrate Network credentials (for GLM 5.1)
- Stripe and/or Paystack keys for deposits

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Key variables (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin/cron operations |
| `INTEGRATE_NETWORK_URL` / `INTEGRATE_NETWORK_KEY` | GLM 5.1 chat, embeddings, Whisper (shared by default) |
| `ZERO_G_PRIVATE_KEY` | 0G wallet for the compute broker & storage uploads |
| `ZERO_G_CHAIN_RPC_URL` | 0G EVM RPC (`https://evmrpc.0g.ai`) |
| `ZERO_G_USD_RATE` | 0G spot price for neuron→credit conversion |
| `ZERO_G_STORAGE_INDEXER_URL` | 0G Storage indexer (mainnet: `https://indexer-storage-turbo.0g.ai`) |
| `NEXT_PUBLIC_ZERO_G_CHAIN_ID` / `NEXT_PUBLIC_ZERO_G_RPC_URL` / `NEXT_PUBLIC_ZERO_G_EXPLORER_URL` | Client-side chain config + receipt anchoring (`16661` / `evmrpc.0g.ai` / `chainscan.0g.ai`) |
| `RECEIPT_REGISTRY_ADDRESS` / `RECEIPT_BATCHER_PRIVATE_KEY` / `CRON_SECRET` | Receipt anchoring (optional — anchoring is skipped if unset) |
| `Z_IMAGE_URL` / `Z_IMAGE_KEY` / `Z_IMAGE_MODEL` / `Z_IMAGE_COST_CREDITS` | Image generation (Z-Image; default cost 100 credits) |
| `WHISPER_*` / `EMBEDDING_*` | Optional overrides; default to the Integrate Network |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | NGN deposits |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | USD/APAC deposits |
| `NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS` / `DEPOSIT_WALLET_PRIVATE_KEY` | On-chain 0G deposit verification |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email (optional) |
| `ADMIN_EMAILS` | Comma-separated admin allowlist |

### 3. Database

Apply the SQL migrations in `supabase/migrations/` to your Supabase project (via the Supabase CLI or dashboard SQL editor). They create the core tables (`profiles`, `chats`, `messages`, `transactions`), the credit RPCs (`deduct_credits`, `add_credits`, `complete_deposit`), attachments, inference receipts + batches, artifacts, message search, edit branches, and the memory layer (`memories` with `pgvector`, `chat_archives`). Also create a public Storage bucket named `chat-attachments`.

### 4. One-time 0G setup (optional, for on-chain paths)

```bash
# Initialize the shared 0G Compute broker ledger (deposits 0G, acknowledges providers)
npx tsx scripts/setup-0g.ts

# Top up a provider sub-account from the ledger
npx tsx scripts/topup-provider.ts <providerAddress> <amount0G>

# Deploy the ReceiptRegistry contract (prints the address for RECEIPT_REGISTRY_ADDRESS)
npm run deploy:registry -- --poster=<batcherAddress>
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Schedule receipt anchoring (production)

`vercel.json` registers an hourly Vercel Cron that hits `GET /api/cron/anchor-receipts` (authorized via `CRON_SECRET`), batching pending receipts and anchoring their Merkle root on-chain. Keep the batcher wallet funded with 0G for gas.

---

## Models

| Model | Type | How it's served |
|---|---|---|
| **GLM 5.1** (`glm-5.1` → `glm-5.1-fp8`) | Chat (text-only) | 0G Integrate Network — "Zhipu · 0G mainnet · TEE-verified". Reasoning tokens disabled so content streams visibly. |
| **Z-Image Turbo** (`z-image-turbo`) | Image generation | Z.AI OpenAI-compatible endpoint |
| Whisper (`openai/whisper-large-v3`) | Speech-to-text | Integrate Network (internal, not user-selectable) |
| `text-embedding-3-small` (1536-dim) | Embeddings | Integrate Network (internal, powers memory recall) |

Chat routing dispatches on the `provider` prefix: `integrate:*` → Integrate Network; any other provider address → 0G Compute broker. Integrate-model pricing is computed dynamically as **wholesale × markup** (input 3.0×, output 2.0×) so margin can't invert when the 0G token price moves; a static `MODEL_PRICING` table is the fallback. **1,000 credits = $1** (1 credit = 0.1¢).

---

## Project structure

```
src/
├─ app/
│  ├─ (auth)/            login, signup, /auth/callback (Google OAuth)
│  ├─ (dashboard)/       chat, chat/[id], deposit, settings, admin
│  ├─ api/               chat, image, transcribe, upload, models, search,
│  │                     chats, messages, artifacts, receipts, balance,
│  │                     deposit/*, exchange-rate, cron/anchor-receipts,
│  │                     admin/*, account/delete
│  └─ page.tsx           landing page
├─ components/
│  ├─ chat/              composer, message list, model picker, mermaid
│  ├─ artifact/          artifact panel, renderer, live React view
│  ├─ 3d/                three.js / r3f landing visuals
│  ├─ layout/            sidebar, top nav, mobile sheet
│  └─ ui/                shadcn-style primitives
├─ lib/                  og-compute, og-storage, integrate-network, memory,
│                        receipts, receipt-anchor, credits, pricing, embeddings,
│                        speech-to-text, image-generation, system-prompt, …
└─ middleware.ts         Supabase session refresh + route protection
contracts/               ReceiptRegistry.sol + ABI
scripts/                 setup-0g, topup-provider, deploy-receipt-registry
supabase/migrations/     schema + RPCs
docs/                    memory-layer, per-user-0g-ledgers-plan
```

---

## Implementation notes

A few capabilities are fully implemented server-side but **not yet wired into the UI** — documented here for accuracy:

- **0G Compute broker models** — `src/lib/og-compute.ts` can discover and call broker providers, and the chat route handles them, but `/api/models` does not surface broker auto-discovery. In practice the shipping chat model is **GLM 5.1** (via the Integrate Network), plus Z-Image for images.
- **On-chain 0G token deposits** — `POST /api/deposit/crypto` verifies a 0G transfer on-chain and converts it to credits, but the deposit page currently offers only Paystack (NGN) and Stripe (USD/APAC).
- **Receipt lookup API** — `GET /api/receipts/[messageId]` returns a receipt plus its on-chain batch (Merkle root, proof, tx hash, explorer link), but no frontend consumes it yet.
- **Per-user on-chain ledgers** — designed in `docs/per-user-0g-ledgers-plan.md` (Plan B), not implemented. The app currently uses a single shared 0G ledger.

---

## License

No license is declared. The package is marked private (`"private": true` in `package.json`); all rights reserved by default.
```
askzero · built on 0G
```
