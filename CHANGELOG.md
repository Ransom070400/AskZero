# Changelog

All notable changes to AskZero are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

These are built and verified locally but not yet live — they ship on the next deploy.

### Added
- **AskZero CLI** and **API Gateway** — scoped/planned (announced as "coming soon").

### Changed
- **Bearer-token auth on Stripe deposit routes** (`/api/deposit/stripe`, `/api/deposit/stripe/verify`) so the mobile app can create and verify Checkout sessions. Deploy required for USD/APAC payments to work on the live site.

### Ops (no code)
- Add `askzero://auth-callback` to Supabase → Auth → Redirect URLs so Google sign-in returns to the mobile app instead of the website.

---

## [2026-07-09] — Free credits, referrals, Code builds & a UX overhaul

### Added
- **Code (agentic build)** — a `/code` page that turns a prompt into working software: **plan → write files → self-review for bugs → runnable deliverable** with a **live preview** (HTML/SVG/React). Quick/standard tiers (60/240 credits), charged on success only. Sidebar + ⌘K entries.
- **Referral credits** — invite a friend and **both get free credits** (referrer +200, new user +100). Settings card with your share link, stats, and a "have a code?" redeem; auto-redeems from the invite link. Codes are allocated lazily and redeemed post-signup, so the signup path can't break.
- **Signup bonus** — new accounts start with **100 free credits**, granted in the hardened signup handler (no `transactions` insert, so signups can't fail). First-run **welcome-credits banner** ("You've got ₦X free to start — you only pay per question").
- **First-run welcome tour** — a one-time walkthrough (incognito, Verify-on-0G, model picker, deposit).
- **"Why AskZero" explainer** — three empty-state cards: Prove it · Pay your way · One tool for everything.
- **⌘K command palette** — search/jump to chats + quick actions (new, incognito, research, code, deposit, settings).
- **Keyboard-shortcuts help overlay** (press `?`) documenting ⌘K, new chat, slash, send, and more.
- **Slash commands** in the composer — `/research`, `/incognito`, `/image` with a filtered menu.
- **Global toast system** (success/error/info), wired through sidebar rename/pin/delete with optimistic revert.
- **Per-chat menu** — inline rename, **pin/unpin** (pinned group on top), inline delete-confirm.
- **Collapsible sidebar rail** — a ⇧-toggle icon rail (persisted) that reclaims ~200px, with a Search icon that opens ⌘K.
- **Richer output** — collapsible `:::details` sections, **chart blocks** (bar/line/area/pie via Recharts), and GitHub-style callouts (`[!NOTE]`…).
- **Code blocks** — filename label (```lang:file), soft-wrap toggle, and a line-number gutter.
- **Message toolbar** — Share (native share / copy fallback) and **regenerate with a different model**.
- **Draft persistence** — unsent composer text is restored per chat (excluded for incognito).
- **Skeleton loaders** for chat history + the sidebar list (no more blank flashes).
- **Low-balance banner** with one-tap Top up (out-of-credits + running-low states).
- **Google sign-in via GIS + `signInWithIdToken`** — no supabase.co redirect on web login/signup.

### Changed
- **Premium motion & polish** (all reduced-motion safe) — View Transitions cross-fade between chats/pages; spring message-entrance (new messages only); a reusable `.hover-lift`; and an animated **balance count-up** on top-up.
- **Plain-language trust copy** — softened What's New, first-run tour, empty state, incognito and receipt copy (benefit-first, less jargon); a "Verified" badge.
- **Empty state** refreshed with example prompts by category (Explore / Create / Code / Analyze), some showcasing tables & charts.
- **Model picker** — 0G Compute providers (Claude Fable 5, Qwen, DeepSeek, MiniMax, …) shown as disabled **"Soon"** while GLM stays the live 0G Compute model; capped dropdown height with scroll; cost/strength heads-up toast on switch.
- **Copy/share strips markdown** — pasted answers are clean (no raw `**`/`#`); code blocks still copy verbatim.
- **Sidebar** — friendlier empty state with a Start-a-chat CTA, relative timestamps (2h/3d/Jul 2), soft scroll-fade masks, and a real ⇧⌘O new-chat shortcut.
- **Stronger formatting directive** so answers use tables/headings/lists/code/math instead of walls of prose.
- **0G Compute robustness** — pump-based Anthropic SSE transform (matches the verified path) and `maxDuration=120` so long reasoning/settlement isn't cut off.
- **README** documents Code, referral/starter credits, and free-credit `bonus` transactions.
- **License metadata** — `"license": "MIT"` + author added to web and mobile `package.json`.

### Fixed
- **Clearer chat error states** — rate-limit (429) messaging, safe JSON parsing, network-drop keeps partial output, plus toasts; Retry via regenerate.

---

## [2026-07-06] — Verifiable inference, incognito & crypto payments

### Added
- **Verifiable receipts in the UI** (web + mobile) — a "Verify on 0G" badge on every answer opens a proof panel that **re-derives the Merkle root from the receipt + proof and confirms it live on-chain** (`isAnchored()`). Tamper-evident by construction.
- **0G Compute in the model picker** — a curated, verified broker model (**GLM 5.1 · 0G Compute**) that runs **on-chain-settled inference** on the decentralized 0G Compute network (not just the Integrate gateway).
- **Incognito mode** — ephemeral chats that aren't saved, aren't remembered, and skip the memory layer. Launch from the top-bar mask icon or the new-chat toggle.
- **Pay with 0G** — connect a wallet (**Reown AppKit / WalletConnect** — MetaMask, Coinbase, mobile wallets via QR) and top up by paying **0G tokens on-chain**, credited at the live 0G/USD price.
- **What's New announcements** — a sequential two-card popup (What's new → Coming soon) with per-version re-broadcast to reach all users.
- **Security policy** — `SECURITY.md`, a public `/security` page, and a Settings → "Security & Privacy" link (web + mobile).
- **MIT `LICENSE`.**
- Model-picker **"Default"** badge; sidebar "coming soon" teasers (Private journaling, Sealed predictions).

### Changed
- **Receipt verification is chain-aware** — the explorer link and on-chain read are derived from the chain each batch was actually anchored on (0G mainnet `16661` / Galileo testnet `16602`).
- **README** rewritten for accuracy — honest framing of what runs on 0G, the billing story, the verifiable-receipts differentiator, Pay with 0G, and new env vars.
- Sidebar trimmed (Deposit & Settings now live in the top nav).

### Fixed
- Receipt lookups resolve immediately after a turn (client adopts the real persisted message id).
- "Anchoring tx not found" — was pointing at the wrong chain's explorer.

### Security
- **0G deposits require a wallet-ownership signature** so no one can claim a stray txHash, plus recipient + 12-confirmation + idempotency checks. Credit amount is computed server-side from the on-chain value.
- Bearer auth added to the receipt and crypto-deposit routes.

---

## [2026-07-06] — Mobile launch & global payments

### Added
- **AskZero mobile app (iOS & Android)** — a full React Native / Expo client sharing the web backend:
  - Animated splash → chat, mirroring the web flow.
  - Chat with live "thinking" steps, streaming answers, and paragraph fade-in.
  - **Autonomous Research** — multi-source, cited reports with live progress.
  - **Image generation**, **file attachments**, and **voice input** (record + transcribe).
  - Balance, deposits, transaction history, and account settings.
  - **Themed markdown rendering** (headings, code blocks, tables, lists, links).
  - **Light mode** with a full light/dark theme system.
  - Email/password and **Continue with Google** sign-in.
- **USD payments** via Stripe Checkout (web + mobile).
- **APAC currency support** — 13 currencies (JPY, SGD, HKD, AUD, NZD, MYR, THB, KRW, PHP, IDR, INR, VND, TWD) via Stripe, with per-currency presets and credit estimates.
- **"What's New" announcement card** on web — dismissible, 5-day window, with the Android APK download link and a "coming soon" section (API Gateway, app stores, CLI).
- **App icon** — the interlocking two-ring AskZero mark (iOS icon + Android adaptive icon).
- **Android APK build** via EAS for direct install / sideloading.

### Changed
- **Deposits route by currency**: NGN → Paystack, USD + APAC → Stripe — on both web and mobile.
- **Un-gated the USD and APAC** currency tabs on the web deposit page (removed "coming soon").
- **Currency selectors** now match across platforms (USD · NGN · APAC picker) in mobile deposit and settings.
- **Logo rendering** switched to a browser-accurate WebView mark (splash animation + chat header) so it matches the brand exactly.
- **API auth** accepts Bearer tokens across the routes the mobile app calls (chat, balance, history, deposits, image, transcribe, upload).

### Fixed
- Mobile header/splash logo clipping and arc-rendering artifacts.
- Mobile data loading (history, balance) — corrected the API base URL and removed the API middleware redirect that blocked bearer-authenticated calls.
- Google OAuth handling on mobile (PKCE code + token-fragment return paths).

---

## [2026-07-05] — Verifiable AI & on-chain memory

### Added
- **On-chain inference receipts** — Merkle-batched receipts anchored on the 0G mainnet registry, with an hourly Vercel cron; verification is performed off-chain.
- **0G Storage memory layer** — memory content uploaded to 0G Storage mainnet, making "on-chain memory" real.
- **Pro model plan** and a **Memory** section in settings.

### Changed
- Migrated 0G Storage integration to `@0gfoundation/0g-storage-ts-sdk`.
