# AskZero Mobile (Expo)

A React Native (Expo) client for AskZero. It talks to the **same backend** as the
web app — the deployed Next.js API — so there is no separate server and no
duplicated business logic. Auth, chat, streaming, credits, models: all served by
the existing `/api/*` routes.

## How it shares the backend

- **Auth:** Supabase (same project as web). The app holds the session in the
  device keychain (`expo-secure-store`) and sends the access token as
  `Authorization: Bearer <token>` on every request.
- **API:** the backend's `getAuthedUser()` helper (`src/lib/supabase/api-auth.ts`)
  resolves that Bearer token exactly like it resolves the web app's session
  cookie — so the same routes serve both clients.
- **Streaming:** `/api/chat` streams SSE; the app reads it with `expo/fetch`
  (which, unlike RN's built-in fetch, supports streaming response bodies).

```
Expo app ──Bearer token──▶  https://<deployment>/api/*  ──▶  0G + Supabase
   (this repo)                 (existing Next.js backend, unchanged)
```

## Setup

```bash
cd mobile
npm install
cp .env.example .env      # fill in EXPO_PUBLIC_API_URL (your deployment)
npx expo start
```

Then press `i` (iOS simulator), `a` (Android), or scan the QR with Expo Go.

> On first run, let Expo align native package versions:
> `npx expo install --fix`

## Environment (`.env`)

| Var | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the deployed AskZero backend (no trailing slash) |
| `EXPO_PUBLIC_SUPABASE_URL` | Same Supabase project as web |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

## Backend prerequisites (already done / to verify)

- ✅ **Bearer auth** — the API routes accept `Authorization: Bearer` (added via
  `getAuthedUser`). Wired into `/api/chat`, `/api/balance`, `/api/chats`.
  `/api/models` is public. Any other route the app needs is a one-line swap to
  `getAuthedUser()`.
- ⚠️ **Google OAuth** — to use "Continue with Google", add the app's redirect
  scheme `askzero://login` to your Supabase Auth → URL Configuration →
  **Redirect URLs**. Email/password works with no extra config.

## What's implemented (MVP)

- Email/password + Google sign-in, session persisted securely.
- New chat + **streaming** assistant replies.
- Live credit balance in the header.

## Not yet (next phases)

- Chat history list & resuming past chats (`GET /api/chats` is wired; UI pending).
- Voice input, image generation, attachments, artifacts.
- Deposits — **note the App Store / Play in-app-purchase policy** on selling
  digital credits before building this screen.
- Markdown / code / math rendering (currently plain text).

## Structure

```
mobile/
├─ app/
│  ├─ _layout.tsx    root layout + AuthProvider
│  ├─ index.tsx      auth-gated redirect
│  ├─ login.tsx      email/password + Google
│  └─ chat.tsx       streaming chat
└─ lib/
   ├─ supabase.ts    Supabase client (SecureStore session)
   ├─ api.ts         typed backend client + SSE streaming
   └─ auth.tsx       AuthProvider / useAuth
```
