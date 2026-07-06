# Security Policy

We take the security of AskZero and our users' data seriously. This document
explains how to report a vulnerability, what's in scope, and what you can expect
from us in return.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Report vulnerabilities privately to:

- **Email:** security@askzerochat.xyz
- Alternatively, use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  ("Report a vulnerability" under the repository's **Security** tab).

To help us triage quickly, please include:

- A clear description of the issue and its potential impact.
- Step-by-step reproduction (proof-of-concept, requests, or a short script).
- Affected surface (web app, mobile app, API, or on-chain contract) and, if
  known, the affected file/endpoint/contract address.
- Your assessment of severity and any suggested remediation.

If you need to share sensitive details, ask us for a secure channel in your first
message and we'll arrange one.

## Our Commitment

- We will acknowledge your report within **3 business days**.
- We will provide an initial assessment and a triage severity within **7 business days**.
- We will keep you informed of remediation progress and let you know when a fix
  ships.
- We practice **coordinated disclosure**: we ask that you give us a reasonable
  window (typically up to **90 days**, sooner for actively exploited issues) to
  remediate before any public disclosure, and we're happy to credit you.

## Scope

**In scope**

- The web application: `https://askzerochat.xyz`
- The AskZero mobile app (iOS / Android) and its API usage
- Backend API routes (`/api/*`) and authentication/authorization flows
- On-chain components (e.g. the inference-receipt registry and related contracts
  on 0G) — logic, access control, and fund-handling bugs
- Payment/credit flows (deposits, verification, credit accounting)
- Data isolation between users (row-level security, memory/chat privacy)

**Out of scope**

- Third-party services we rely on — report those to the respective vendor:
  - Supabase (auth/database/storage)
  - Stripe and Paystack (payment processing; card data never touches our servers)
  - 0G network infrastructure (chain, storage indexers, compute providers)
  - Vercel / hosting infrastructure
- Findings that require a compromised device, rooted/jailbroken OS, or a
  physically stolen unlocked phone.
- Social engineering, phishing, or physical attacks against AskZero staff or users.
- Missing security headers, or best-practice suggestions with no demonstrable
  impact, unless chained into a concrete exploit.
- Denial-of-service / volumetric / rate-limit testing (see rules below).
- Automated scanner output without a validated, reproducible finding.

## Rules of Engagement (Safe Harbor)

We will not pursue or support legal action against researchers who, in good faith:

- Make a genuine effort to avoid privacy violations, data destruction, and
  service disruption.
- **Only access, modify, or store data belonging to accounts you own or control.**
  Do not access, exfiltrate, or retain other users' data. If you inadvertently
  encounter another user's data, stop and report it immediately.
- Do **not** run denial-of-service, spam, brute-force, or high-volume automated
  attacks against production.
- Do **not** perform testing that could impact real payments, real funds, or
  on-chain assets belonging to others. Use test amounts and your own accounts.
- Give us a reasonable time to remediate before public disclosure and keep
  vulnerability details confidential until a fix is released.

Acting in accordance with this policy is considered authorized conduct, and we
will work with you to understand and resolve the issue quickly.

## Supported Versions

AskZero is a continuously deployed web and mobile product. Security fixes are
applied to the **latest production release** of the web app and the **latest
published build** of the mobile app. Older, unpublished builds are not patched —
please update to the current version.

## Existing Controls (context for researchers)

Not a guarantee, but the baseline we build on:

- **Row-Level Security** is enabled on all user-data tables, with owner-scoped
  policies; privileged writes go through `SECURITY DEFINER` server routines.
- Secrets are held server-side (never shipped to clients). Client keys are the
  public/publishable variety, protected by RLS and provider-side rules.
- **Payment card data is handled entirely by Stripe/Paystack** — we never store
  or process raw card details (PCI scope minimized).
- Authenticated API access uses short-lived bearer tokens.
- AI inference receipts are anchored on 0G for tamper-evident, verifiable logs.

## Recognition

We currently do **not** run a paid bug-bounty program, but we deeply appreciate
responsible disclosure and are happy to publicly credit researchers (with your
permission) for valid, in-scope reports.

---

_Thank you for helping keep AskZero and its users safe._
