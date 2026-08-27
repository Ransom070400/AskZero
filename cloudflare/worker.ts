// Custom Worker entrypoint.
//
// OpenNext generates `.open-next/worker.js` with a `fetch` handler for the Next
// app, but no `scheduled` handler — and Cloudflare has no equivalent of
// `vercel.json` crons. This file wraps the generated worker so the hourly
// receipt anchoring keeps running after the move off Vercel.
//
// `.open-next/worker.js` only exists after `opennextjs-cloudflare build`, so
// this directory is excluded from tsconfig; wrangler's bundler resolves it.
//
// @ts-expect-error - generated at build time
import openNextWorker from "../.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  APP_ORIGIN?: string;
}

// The cron path and its schedule live here and in wrangler.jsonc respectively.
const CRON_PATH = "/api/cron/anchor-receipts";

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return openNextWorker.fetch(request, env, ctx);
  },

  // Cloudflare Cron Trigger. Rather than duplicating the anchoring logic, this
  // dispatches an internal request through the app's own fetch handler, so the
  // route runs exactly as it does in production — same auth check, same code.
  // It never leaves the Worker, so the secret isn't sent over the network.
  async scheduled(
    event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    if (!env.CRON_SECRET) {
      console.error("cron: CRON_SECRET is not set — skipping receipt anchoring");
      return;
    }

    // Origin is irrelevant to routing (the request never goes over the wire)
    // but Next needs an absolute, well-formed URL.
    const origin = env.APP_ORIGIN ?? "https://askzero.ai";
    const request = new Request(new URL(CRON_PATH, origin), {
      method: "GET",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });

    try {
      const response = await openNextWorker.fetch(request, env, ctx);
      const body = await response.text();
      if (!response.ok) {
        // Surfaces in `wrangler tail`. The anchoring route now fails loudly
        // when the registry is misconfigured, and this is where that shows up.
        console.error(`cron ${CRON_PATH} -> ${response.status}: ${body}`);
        return;
      }
      console.log(`cron ${CRON_PATH} -> ${response.status}: ${body}`);
    } catch (err) {
      console.error(`cron ${CRON_PATH} threw:`, err);
    }
  },
};
