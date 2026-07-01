import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// Cap extracted PDF text to avoid blowing up the prompt — ~50k chars ≈ 12k tokens.
const MAX_PDF_TEXT_CHARS = 50_000;

async function extractPdfText(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text || "").trim();
      if (!text) return null;
      return text.length > MAX_PDF_TEXT_CHARS
        ? text.slice(0, MAX_PDF_TEXT_CHARS) + "\n\n[…truncated]"
        : text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const chatId = formData.get("chatId") as string | null;

  if (!file || !chatId) {
    return NextResponse.json(
      { error: "File and chatId are required" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not supported. Use JPEG, PNG, GIF, WebP, or PDF." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() || "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${user.id}/${chatId}/${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-attachments").getPublicUrl(path);

  let extractedText: string | null = null;
  if (file.type === "application/pdf") {
    extractedText = await extractPdfText(arrayBuffer);
  }

  return NextResponse.json({
    url: publicUrl,
    path,
    name: file.name,
    type: file.type,
    size: file.size,
    ...(extractedText ? { extractedText } : {}),
  });
}
