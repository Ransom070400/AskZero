import { getCloudflareContext } from "@opennextjs/cloudflare";

// Keep the Worker alive until `work` settles, even if the client disconnects.
// Workers cancel a request's pending work when the client goes away unless it
// is registered with ctx.waitUntil, so without this a user pressing Stop could
// skip billing and saving the partial answer. Outside Workers (next dev / a
// Node server) the promise simply runs to completion on its own.
export function keepAlive(work: Promise<unknown>): void {
  try {
    getCloudflareContext().ctx.waitUntil(work);
  } catch {
    // Not running on Workers.
  }
}
