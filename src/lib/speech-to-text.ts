// Speech-to-text via openai/whisper-large-v3 on the 0G Integrate Network.
// The network is OpenAI-compatible, so transcription uses the standard
// /audio/transcriptions endpoint (multipart upload, JSON { text } back) —
// the audio sibling of the /chat/completions and /images/generations
// endpoints used elsewhere.
//
// Config falls back to the shared Integrate Network credentials, with
// optional WHISPER_* overrides if the provider/endpoint differs.

function sttBaseUrl(): string | undefined {
  return process.env.WHISPER_URL ?? process.env.INTEGRATE_NETWORK_URL;
}

function sttApiKey(): string | undefined {
  return process.env.WHISPER_KEY ?? process.env.INTEGRATE_NETWORK_KEY;
}

export function sttModel(): string {
  // Default matches the id the 0G Integrate Network exposes for Whisper
  // (verified via its /v1/models listing). Override with WHISPER_MODEL.
  return process.env.WHISPER_MODEL ?? "openai/whisper-large-v3";
}

export function isSttConfigured(): boolean {
  return Boolean(sttBaseUrl() && sttApiKey());
}

// Flat credit cost per transcription (1000 credits = $1). Whisper is cheap to
// run, so a small flat charge keeps things simple and predictable; tune via
// WHISPER_COST_CREDITS.
export function sttCostCredits(): number {
  const raw = process.env.WHISPER_COST_CREDITS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

// Max audio size we accept (bytes). Keeps a runaway upload from hitting the
// provider; ~25MB matches the common Whisper upload limit.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export interface TranscribeResult {
  text: string;
}

export async function transcribeAudio(
  file: File | Blob,
  opts: { language?: string; filename?: string } = {}
): Promise<TranscribeResult> {
  const baseUrl = sttBaseUrl();
  const apiKey = sttApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error("Speech-to-text is not configured");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;

  const form = new FormData();
  form.append("file", file, opts.filename ?? "audio.webm");
  form.append("model", sttModel());
  form.append("response_format", "json");
  if (opts.language) form.append("language", opts.language);

  // NOTE: do not set Content-Type — fetch derives the multipart boundary.
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Transcription error (${response.status}): ${text.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}
