// Shared plumbing for calls to model providers.

// How long a provider gets to start responding (headers) before we give up.
// Only the wait for the response is bounded: once it starts streaming, a long
// answer is fine, and the caller's signal (client hung up) still cancels it.
const FIRST_BYTE_TIMEOUT_MS = 60_000;

export interface UpstreamOptions {
  stream?: boolean;
  // Aborts the request and the response body (e.g. the user pressed Stop).
  signal?: AbortSignal;
}

export async function fetchUpstream(
  url: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const timer = setTimeout(
    () => controller.abort(new UpstreamError("The model took too long to respond.")),
    FIRST_BYTE_TIMEOUT_MS
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.reason instanceof UpstreamError) {
      throw controller.signal.reason;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// An error whose message is safe to show the user. Raw provider bodies can
// carry internal details, so they're logged and replaced with this.
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function upstreamFailure(
  label: string,
  response: Response
): Promise<UpstreamError> {
  const body = await response.text().catch(() => "");
  console.error(`${label} error (${response.status}): ${body.slice(0, 1000)}`);
  const message =
    response.status === 429
      ? "The model is busy right now. Try again in a moment."
      : response.status === 400 || response.status === 413
        ? "The model couldn't accept this conversation (it may be too long)."
        : "The model is unavailable right now. Try again, or pick another model.";
  return new UpstreamError(message, response.status);
}

// Token usage as the provider reports it, when it does.
export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}
