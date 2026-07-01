import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { checkBalance, deductCredits } from "@/lib/credits";
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

  const cost = sttCostCredits();
  try {
    const balance = await checkBalance(user.id);
    if (balance < cost) {
      return json(
        { error: "Insufficient credits", balance, depositUrl: "/deposit" },
        402
      );
    }
  } catch {
    // proceed — balance lookup failures shouldn't hard-block transcription
  }

  let text: string;
  try {
    const result = await transcribeAudio(file, { filename: file.name });
    text = result.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcription failed";
    return json({ error: msg }, 502);
  }

  // Only charge when we actually got something back.
  if (text) {
    try {
      await deductCredits(user.id, cost, {
        kind: "stt",
        model: sttModel(),
        bytes: file.size,
        chars: text.length,
      });
    } catch {
      console.error("deductCredits failed for transcription");
    }
  }

  return json({ text }, 200);
}
