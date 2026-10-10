import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import {
  reserveCredits,
  settleCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  isSttConfigured,
  transcribeAudio,
  sttCostCredits,
  sttModel,
  MAX_AUDIO_BYTES,
} from "@/lib/speech-to-text";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();

  if (!user) return json({ error: "Unauthorized" }, 401);

  const { ok } = rateLimit(`stt:${user.id}`, 10);
  if (!ok) return rateLimitResponse();

  if (!isSttConfigured()) {
    return json({ error: "Voice input is not available right now" }, 503);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: "No audio provided" }, 400);
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return json({ error: "Recording too large" }, 413);
  }
  if (file.type && !file.type.startsWith("audio/")) {
    return json({ error: "Unsupported file type" }, 415);
  }

  // Hold the cost up front; it's refunded if transcription fails or comes
  // back empty.
  const cost = sttCostCredits();
  let holdId: string;
  try {
    holdId = await reserveCredits(user.id, cost, { kind: "stt", model: sttModel() });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return json({ error: "Insufficient credits", depositUrl: "/deposit" }, 402);
    }
    console.error("reserveCredits failed for transcription", err);
    return json({ error: "Voice input is not available right now" }, 503);
  }

  let text = "";
  try {
    const result = await transcribeAudio(file, { filename: file.name });
    text = result.text;
  } catch (err) {
    console.error("transcription failed", err);
    return json({ error: "Transcription failed. Please try again." }, 502);
  } finally {
    await settleCredits(holdId, text ? cost : 0, {
      bytes: file.size,
      chars: text.length,
    }).catch((err) => console.error("settleCredits failed for transcription", err));
  }

  return json({ text }, 200);
}
