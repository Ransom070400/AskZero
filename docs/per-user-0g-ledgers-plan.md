# Plan B — Per-User On-Chain 0G Ledgers

> **Status:** Design / not started. This is a "for later" plan. Option A
> (custodial pooled credits + fiat deposit → balance you spend on inference)
> is already built and shipping. This document describes how to evolve to
> Option B, where a user's deposit funds **their own on-chain 0G compute
> ledger** and their inference settles from it.

---

## 1. Goal

Today every user taps **one** shared 0G ledger. To 0G the network, AskZero is
a single customer. Plan B gives each (opted-in) user their **own 0G ledger**,
funded from their deposit, so:

- Inference settles from the user's own on-chain balance, not a pooled one.
- The 0G network sees real per-user demand.
- Combined with per-user signing identity (see `Phase 1` in the receipts work),
  receipts are both **signed by** and **paid from** the user's own address —
  genuinely user-attributable compute.

This is **opt-in and additive**. Option A stays the default. Do not rip out
credits/Postgres — Plan B runs alongside it for users who want it.

---

## 2. Current architecture (as-is)

### Money in
- **Fiat (Paystack/Stripe)** → `api/deposit/initialize` + webhooks →
  `complete_deposit` / `add_credits` RPC → `profiles.credits_balance`
  (USD cents, pooled, custodial).
- **Crypto (0G)** → user sends 0G to a single `DEPOSIT_WALLET_ADDRESS` →
  `api/deposit/crypto` verifies on-chain → `credit_balance` RPC →
  `profiles.credits_balance`.

### Balance & metering
- One number per user: `profiles.credits_balance` (`1000 credits = $1`).
- Deduct after each response via `deduct_credits` RPC (`lib/credits.ts`),
  atomic, row-locked. Cost computed in `api/chat/route.ts` after the stream
  ends (`calculateCost` / `retailCostCredits`).

### Inference (two paths — important)
1. **0G Compute broker** — `lib/og-compute.ts:sendPrompt()` →
   `broker.inference` over the **shared** wallet (`ZERO_G_PRIVATE_KEY`).
   Real on-chain settlement through one shared ledger.
   - Ledger funded once by `scripts/setup-0g.ts` (`broker.ledger.depositFund`).
   - Provider sub-accounts funded by `scripts/topup-provider.ts`
     (`broker.ledger.transferFund(provider, "inference", amount)`).
2. **Integrate Network** — `lib/integrate-network.ts:sendIntegratePrompt()`.
   Plain HTTPS proxy to a provider, authenticated with **one**
   `INTEGRATE_NETWORK_KEY`. **Never touches the chain per request.** This is
   the GLM-5.1 path.

> ⚠️ **Plan B only applies to path #1 (the broker).** The Integrate Network
> path is itself a centralized gateway with a single key; it cannot be made
> per-user-on-chain unless the provider exposes per-user settlement. Decide
> per-model which path a user is on (see §8).

### Receipts (already built)
- Built in `api/chat/route.ts` via `lib/receipts.ts:buildReceipt`, stored via
  `record_receipt` RPC into `inference_receipts`, batched into Merkle roots and
  anchored on-chain by `lib/receipt-anchor.ts` under `RECEIPT_BATCHER_PRIVATE_KEY`.
- The receipt hash already commits `userId`, but nothing the user controls
  signs it. (That gap is "Phase 1 / per-user signing identity" — a prerequisite
  worth doing first; see §7.0.)

---

## 3. What Plan B requires (the core change)

For each opted-in user:

1. **A per-user wallet** — deterministically derived, server-custodied
   (Google users have no wallet of their own).
2. **A per-user 0G ledger** — created + funded from that wallet via
   `broker.ledger.depositFund`.
3. **Inference routed through a per-user broker** —
   `createZGComputeNetworkBroker(userWallet)` instead of the shared one.
4. **Deposit → on-chain funding pipeline** — fiat/crypto in becomes 0G in the
   user's ledger.
5. **Balance read from the ledger** (cached in Postgres), not only from
   `credits_balance`.

---

## 4. The hard problems (read before estimating)

These are the reasons Plan B is "later", not "now". Each needs a decision.

### 4.1 Gas
Every ledger op (`depositFund`, `transferFund`, `acknowledgeProviderSigner`,
settlement) is a transaction **signed by the user's own wallet** and **costs
A0GI gas**. So each user wallet must hold a little A0GI for gas.
- **Decision:** platform sponsors gas by sweeping a small A0GI float into each
  user wallet on provisioning (and topping up as it drains). There is no native
  paymaster here — the wallet pays its own gas, so it must be pre-funded.

### 4.2 Treasury / on-ramp
Fiat deposits arrive as **NGN/USD in Paystack/Stripe**, but ledgers need
**actual 0G tokens**. Someone has to acquire 0G with collected fiat and hold a
treasury to fund user ledgers.
- This is an **operational** problem (exchange/OTC purchase of 0G, bridging to
  0G chain, treasury float management), not just code.
- **Decision:** maintain a hot treasury wallet with a 0G float; fund user
  ledgers from it; replenish the treasury on a schedule from collected fiat.

### 4.3 Custody / key security
One master seed deriving every user wallet = single point of compromise for
**all** user funds. Today's keys gate a pooled hot wallet; Plan B raises the
blast radius to per-user balances.
- **Decision:** master seed in a KMS/HSM (not an env var). Derivation happens
  inside a signing service, not in the Next.js route. Rotate-able.

### 4.4 Reconciliation / source of truth
Balance now lives **on-chain per user**. `credits_balance` becomes a mirror.
Two sources of truth can drift (failed tx, reorg, gas spent, price moves).
- **Decision:** on-chain ledger is the source of truth for Plan-B users;
  Postgres holds a cached `ledger_balance_0g` + `last_synced_at`. A
  reconciliation job re-reads ledgers and corrects drift.

### 4.5 Latency & minimums
- Funding a ledger on deposit adds on-chain confirmation time to the deposit
  UX. `setup-0g.ts` uses a 3 A0GI minimum for the shared ledger — per-user
  minimums could exceed small deposits.
- **Decision:** buffer small deposits in the treasury and fund the user ledger
  lazily (on first inference, or when buffered ≥ a threshold), rather than one
  on-chain tx per tiny deposit.

### 4.6 Withdrawals / refunds
Once a user has real 0G in a ledger, they may expect to withdraw the unused
portion (`broker.ledger.retrieveFund`). That's a policy + compliance question.
- **Decision:** define whether Plan-B balances are withdrawable, to where, and
  KYC implications. Default for v1: **non-withdrawable**, spend-only (keeps it
  closer to "prepaid compute" than "custody of funds").

### 4.7 Margin moves to the deposit step
Today margin is the markup at spend time (`INPUT_MARKUP`/`OUTPUT_MARKUP`,
`MODEL_PRICING`). If a user spends directly from their own ledger at wholesale,
the spend-time markup disappears.
- **Decision:** take margin at **funding/conversion** time — user deposits $10,
  you allocate ~$9 of 0G to their ledger and keep the spread. See §8.

---

## 5. Target architecture

```
            fiat (Paystack/Stripe)            crypto (0G)
                   │                               │
                   ▼                               ▼
            complete_deposit                api/deposit/crypto
                   │                               │
                   └──────────────┬────────────────┘
                                  ▼
                    Plan-B user?  ──no──▶  credit profiles.credits_balance   (Option A, unchanged)
                                  │yes
                                  ▼
                     deposit_intent (buffered, fiat→0G @ rate, minus margin)
                                  │
                                  ▼
                     Treasury wallet (0G float, KMS-signed)
                                  │   fund when buffered ≥ threshold
                                  ▼
              user wallet (derived, gas-sponsored)
                                  │  broker.ledger.depositFund
                                  ▼
                       user 0G ledger  ◀────── source of truth
                                  │
        chat route ──▶ per-user broker (createZGComputeNetworkBroker(userWallet))
                                  │  inference settles on user ledger
                                  ▼
             receipt signed by + paid from user address  ──▶ anchored (existing pipeline)
```

Key principle: **money path and identity path converge** — the wallet that
*signs* the receipt (Phase 1) is the same wallet that *pays* for the inference
(Plan B).

---

## 6. Data model changes

New table (or columns) — proposed:

```sql
-- One on-chain identity + ledger per opted-in user.
create table user_ledgers (
  user_id            uuid primary key references profiles(id) on delete cascade,
  address            text not null,            -- derived wallet address (also the receipt signer)
  mode               text not null default 'pooled',  -- 'pooled' (A) | 'onchain' (B)
  ledger_balance_0g  numeric not null default 0,      -- cached mirror of on-chain ledger
  gas_balance_a0gi   numeric not null default 0,      -- cached gas float
  provisioned_at     timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);

-- Buffer fiat→0G conversions before they hit the chain (handles minimums/latency).
create table deposit_intents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  source_ref      text,                         -- transactions.reference
  amount_0g       numeric not null,             -- net of margin
  margin_credits  numeric not null default 0,
  status          text not null default 'buffered', -- buffered|funding|funded|failed
  tx_hash         text,
  created_at      timestamptz not null default now()
);
```

- Add `address` / `user_address` + `user_sig` to `inference_receipts` (Phase 1).
- `transactions` already records deposits; add a metadata flag for B-mode
  fundings so accounting can separate pooled vs on-chain spend.

---

## 7. Implementation phases (incremental, shippable)

Order matters — each phase is independently useful and de-risks the next.

### 7.0 Prerequisite — per-user signing identity ("Phase 1")
Derive a server-custodied wallet per user and have it sign the receipt hash.
No money yet. Establishes the address Plan B will fund.
- `lib/user-identity.ts`: `userWallet(userId)`, `userAddress(userId)`.
- Commit `userAddress` into `hashReceipt` (`lib/receipts.ts`), store `user_sig`.
- **Move seed derivation into a KMS-backed signer before this holds funds.**

### 7.1 Wallet provisioning + gas sponsorship
- On opt-in, write `user_ledgers` row, derive address, sweep a small A0GI gas
  float from treasury → user wallet.
- Background job tops up gas when `gas_balance_a0gi` drops below a floor.

### 7.2 Ledger provisioning
- First time a user goes B-mode: `createZGComputeNetworkBroker(userWallet)` →
  `ledger.depositFund(...)` → `acknowledgeProviderSigner(provider)` for each
  active provider. Mirror `scripts/setup-0g.ts`, but per user.
- Idempotent + resumable (txs can fail midway).

### 7.3 Deposit → funding pipeline
- In `complete_deposit` / `api/deposit/crypto`, branch on `mode`:
  - `pooled` → existing `credits_balance` path (unchanged).
  - `onchain` → create `deposit_intent` (fiat→0G at `getOGTokenPrice()`, minus
    margin), buffer, and fund the ledger when threshold reached (§4.5).
- Treasury wallet (KMS) signs the funding transfer to the user wallet, then the
  user wallet `depositFund`s its ledger.

### 7.4 Inference routing
- In `api/chat/route.ts`, when the user is `onchain` **and** the model is a
  broker model (not Integrate), build the per-user broker and route through it.
  Cost is settled on-chain; record actual settled cost in the receipt.
- When `pooled` or Integrate model → existing path. Keep both working.

### 7.5 Balance display + reconciliation
- Read ledger balance via broker (`getLedger`/equivalent), cache into
  `user_ledgers.ledger_balance_0g`, show "X 0G of compute" in the UI.
- Reconciliation cron re-syncs all B-mode ledgers, corrects drift, alerts on
  treasury/gas float running low.

### 7.6 Receipts under user identity
- For B-mode, the receipt is paid from and signed by the user wallet. Anchor
  via the existing `receipt-anchor.ts` pipeline (unchanged — it just notarizes
  leaves). Verification recovers the signer == `userAddress(userId)`.

### 7.7 (Optional) Withdrawals
- Only if policy allows (§4.6). `ledger.retrieveFund` → treasury → off-ramp.
  Gate behind KYC. Default v1: omit.

---

## 8. Margin model under Plan B

| | Option A (today) | Option B |
|---|---|---|
| Where margin is taken | spend time (`INPUT_MARKUP` 3×, `OUTPUT_MARKUP` 2×) | **deposit/conversion time** |
| What the user spends from | pooled credits | their own 0G ledger (wholesale) |
| Example | $10 → 10,000 credits, marked-up per message | $10 → fund ~$9 of 0G, keep $1 spread |

Because B-mode users spend at wholesale from their own ledger, **margin must be
front-loaded at funding**. Set the fiat→0G conversion rate to bake in the same
effective margin you get from A's spend-time markup, plus a buffer for gas you
sponsor (§4.1) and 0G price drift between funding and spend.

---

## 9. Open decisions (resolve before building)

1. **Opt-in surface** — who gets B? Power users / a toggle / a separate "API
   plan"? Is this tied to the public inference-API product (API keys)?
2. **Withdrawable or spend-only?** (compliance blast radius — §4.6)
3. **Per-model routing** — GLM-5.1 is Integrate-only (can't be on-chain
   per-user). Do B-mode users only get broker models? Or a hybrid bill?
4. **Treasury ops owner** — who buys/holds/bridges 0G and watches the float?
5. **KMS/HSM choice** for the master seed (§4.3).
6. **Funding cadence** — per-deposit vs buffered-threshold (§4.5).
7. **What happens to a user's `credits_balance`** when they switch A→B? Migrate
   the pooled balance into their ledger, or run both?

---

## 10. Risk / effort summary

- **Effort:** large. The code (per-user broker, routing, data model) is the
  *small* part. Treasury ops, gas sponsorship, KMS custody, and reconciliation
  are the bulk and the risk.
- **Biggest risks:** key custody (all-user blast radius), treasury float
  management, on-chain funding failures mid-pipeline, and margin inversion if
  the fiat→0G rate isn't buffered for gas + price drift.
- **De-risking move:** ship 7.0 (signing identity) and 7.1 (wallets, no funds)
  first — they're useful on their own and prove the derivation/custody story
  before any real 0G is at stake.

---

## Appendix — key files touched

| Concern | File(s) |
|---|---|
| Shared broker / ledger | `src/lib/og-compute.ts`, `scripts/setup-0g.ts`, `scripts/topup-provider.ts` |
| Integrate (off-chain) path | `src/lib/integrate-network.ts` |
| Inference + deduct + receipt | `src/app/api/chat/route.ts` |
| Credits / balance | `src/lib/credits.ts`, `supabase/migrations/20260403000000_create_core_tables.sql` |
| Deposit flows | `src/app/api/deposit/{initialize,crypto,verify,stripe,webhook}` |
| Deposit atomicity | `supabase/migrations/20260505000000_atomic_deposit_completion.sql` |
| 0G price / conversion | `src/lib/og-token.ts`, `src/lib/pricing.ts` |
| Receipts | `src/lib/receipts.ts`, `src/lib/receipt-anchor.ts`, `supabase/migrations/20260504000000_inference_receipts.sql` |
