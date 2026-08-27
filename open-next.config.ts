// OpenNext adapter config for Cloudflare Workers.
//
// No incremental-cache override is set on purpose. This app has no ISR — there
// is no `export const revalidate` anywhere, every API route is dynamic, and the
// handful of static pages are plain prerendered assets. Adding the R2 cache
// from the default template would mean provisioning and paying for a bucket
// that nothing would ever read.
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig();
