import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

// `NEXT_PUBLIC_*` values are inlined into the bundle at BUILD time, so they have
// to be present in the build environment — setting them as runtime-only secrets
// does nothing. Without them the build dies deep inside prerendering with
// "@supabase/ssr: Your project's URL and API key are required", repeated once
// per page and with no hint as to which variable is missing or why.
//
// Fail fast and say exactly what's missing instead. Note this SHOULD fail the
// build: letting it through would ship a bundle with `undefined` baked in, which
// breaks silently in the user's browser rather than loudly in CI.
const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

// Not fatal — each one degrades a single feature rather than breaking the app.
const OPTIONAL_PUBLIC_ENV = [
  "NEXT_PUBLIC_DEPOSIT_WALLET_ADDRESS",
  "NEXT_PUBLIC_REOWN_PROJECT_ID",
  "NEXT_PUBLIC_ZERO_G_CHAIN_ID",
  "NEXT_PUBLIC_ZERO_G_RPC_URL",
  "NEXT_PUBLIC_ZERO_G_EXPLORER_URL",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
];

function assertBuildEnv() {
  const missing = REQUIRED_PUBLIC_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `\n\nMissing required build-time environment variables:\n` +
        missing.map((k) => `  - ${k}`).join("\n") +
        `\n\nThese are NEXT_PUBLIC_* vars: Next.js inlines them into the bundle at\n` +
        `build time, so they must be set as BUILD variables. Runtime-only secrets\n` +
        `are not enough — on Cloudflare use Settings > Build > "Build variables and\n` +
        `secrets", not just the runtime bindings.\n`
    );
  }

  // Next loads this config once per build worker process, so without a sentinel
  // the warning prints several times. Child processes inherit process.env.
  const absent = OPTIONAL_PUBLIC_ENV.filter((k) => !process.env[k]);
  if (absent.length > 0 && !process.env.__ASKZERO_ENV_WARNED) {
    process.env.__ASKZERO_ENV_WARNED = "1";
    console.warn(
      `\n⚠ Building without these optional public vars — the features they gate\n` +
        `  will be inert in this deployment:\n` +
        absent.map((k) => `  - ${k}`).join("\n") +
        `\n`
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image is not used anywhere (attachments render as plain <img>), so no
  // remotePatterns are needed and the Cloudflare Images binding can stay off.
};

export default (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) assertBuildEnv();
  return nextConfig;
};
