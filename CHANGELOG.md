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
