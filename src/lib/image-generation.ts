// Z-Image (Z.AI text-to-image) integration. Defaults to the same Integrate
// Network proxy you already use for GLM 5.1, but the URL/key/model are
// independently overridable so you can point at api.z.ai or a 0G provider.

export interface ImageGenInput {
  prompt: string;
  size?: string;          // e.g. "1024x1024", "1024x1792"
  n?: number;             // we always render the first; >1 wastes credits today
}

export interface ImageGenResult {
  bytes: Uint8Array;
  contentType: string;
  upstreamModel: string;
}

const DEFAULT_SIZE = "1024x1024";
const DEFAULT_CONTENT_TYPE = "image/png";

export function imageGenCostCredits(): number {
  const raw = process.env.Z_IMAGE_COST_CREDITS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export function isImageGenConfigured(): boolean {
  const url = process.env.Z_IMAGE_URL ?? process.env.INTEGRATE_NETWORK_URL;
  const key = process.env.Z_IMAGE_KEY ?? process.env.INTEGRATE_NETWORK_KEY;
  return Boolean(url && key);
}

export async function generateImage(input: ImageGenInput): Promise<ImageGenResult> {
  const baseUrl = process.env.Z_IMAGE_URL ?? process.env.INTEGRATE_NETWORK_URL;
  const apiKey = process.env.Z_IMAGE_KEY ?? process.env.INTEGRATE_NETWORK_KEY;
  const model = process.env.Z_IMAGE_MODEL ?? "z-image-turbo";

  if (!baseUrl || !apiKey) {
    throw new Error("Image generation is not configured (Z_IMAGE_URL / Z_IMAGE_KEY)");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/images/generations`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      size: input.size ?? DEFAULT_SIZE,
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Z-Image error (${response.status}) at ${url} [model=${model}]: ${text.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const item = data.data?.[0];
  if (!item) throw new Error("Z-Image returned an empty response");

  let bytes: Uint8Array;
  if (item.b64_json) {
    bytes = new Uint8Array(Buffer.from(item.b64_json, "base64"));
  } else if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) {
      throw new Error(`Z-Image asset fetch failed: ${imgRes.status}`);
    }
    bytes = new Uint8Array(await imgRes.arrayBuffer());
  } else {
    throw new Error("Z-Image response had neither b64_json nor url");
  }

  return { bytes, contentType: DEFAULT_CONTENT_TYPE, upstreamModel: model };
}
