import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { deductCredits, checkBalance } from "@/lib/credits";
import { calculateCost } from "@/lib/pricing";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sanitizeInput, validateMessage } from "@/lib/sanitize";
import { sendLowBalanceWarning } from "@/lib/email";
import {
  INTEGRATE_PREFIX,
  findIntegrateModel,
  sendIntegratePrompt,
  retailCostCredits,
} from "@/lib/integrate-network";
import { ogRetailCostCredits } from "@/lib/og-compute-models";
import { buildReceipt, makeNonce } from "@/lib/receipts";
import { buildSystemPrompt, type ChatStyle } from "@/lib/system-prompt";
import { runAgentLoop } from "@/lib/agent";
import { detectArtifacts } from "@/lib/artifact-detect";
import {
  recallMemories,
  formatMemoriesForPrompt,
  commitMemory,
} from "@/lib/memory";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MIN_CREDITS = 5;

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { ok } = rateLimit(`chat:${user.id}`, 20);
  if (!ok) return rateLimitResponse();

  const body = await req.json();
  const chatId = body.chatId;
  const message = sanitizeInput(body.message || "");
  const model = body.model;
  const provider = body.provider;
  const attachments = body.attachments || [];
  const style = (body.style as ChatStyle | undefined) ?? "default";
  const replacesId =
    typeof body.replacesId === "string" && body.replacesId.length > 0
      ? body.replacesId
      : null;
  // Incognito (Phase 1 — ephemeral): nothing is persisted (no chat/message
  // rows), memory is neither recalled nor written, and no receipt is anchored.
  // The client sends the full session transcript in `body.history` since there
  // is nothing to load from the DB. Credits are still charged for the inference.
  const incognito = body.incognito === true;

  const hasAttachments = attachments.length > 0;
  if (!hasAttachments) {
    const { valid, error: validationError } = validateMessage(message);
    if (!valid) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }
  }

  if (!provider) {
    return new Response(
      JSON.stringify({ error: "No model selected. Please select a model." }),
      { status: 400 }
    );
  }

  // Check balance
  try {
    const balance = await checkBalance(user.id, supabase);
    if (balance < MIN_CREDITS) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          balance,
          depositUrl: "/deposit",
        }),
        { status: 402 }
      );
    }
  } catch {
    // proceed
  }

  // Save user message (skipped entirely in incognito — nothing is persisted).
  const metadata = attachments.length > 0 ? { attachments } : {};
  if (!incognito) {
    const { error: insertError } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: message,
      token_count: estimateTokens(message),
      metadata,
      ...(replacesId ? { replaces_id: replacesId } : {}),
    });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500 }
      );
    }
  }

  // Load conversation history (active branch only — soft-deleted edit
  // branches stay in the DB but are excluded from the model context).
  // Falls back without the deleted_at filter if the column isn't there
  // yet (i.e. the 20260520010000_message_edit_branches.sql migration
  // hasn't been applied) — otherwise the silent failure would send the
  // model an empty conversation and yield generic-looking replies.
  let history: { role: string; content: string; metadata?: { attachments?: { name?: string; type: string; url: string; extractedText?: string }[] } }[] | null = null;
  if (incognito) {
    // Ephemeral: the client owns the transcript. Use it directly (text-only in
    // Phase 1), capped to the same window as persisted chats.
    const provided = Array.isArray(body.history) ? body.history : [];
    history = provided
      .filter(
        (m: { role?: string; content?: unknown }) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string"
      )
      .slice(-50)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));
  } else {
    const primary = await supabase
      .from("messages")
      .select("role, content, metadata")
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (primary.error?.code === "42703") {
      const fallback = await supabase
        .from("messages")
        .select("role, content, metadata")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(50);
      history = fallback.data;
    } else {
      history = primary.data;
    }
  }

  const historyMessages = (history || []).map(
    (m: {
      role: string;
      content: string;
      metadata?: {
        attachments?: { name?: string; type: string; url: string; extractedText?: string }[];
      };
    }) => {
      const atts = m.metadata?.attachments || [];
      const imgAtts = atts.filter((a) => a.type.startsWith("image/"));
      const pdfAtts = atts.filter(
        (a) => a.type === "application/pdf" && a.extractedText
      );

      // Inline PDF text into the user content so the model can read it.
      let textContent = m.content;
      if (pdfAtts.length > 0 && m.role === "user") {
        const pdfBlocks = pdfAtts
          .map(
            (a) =>
              `[Attached PDF: ${a.name || "document.pdf"}]\n${a.extractedText}`
          )
          .join("\n\n");
        textContent = textContent
          ? `${textContent}\n\n${pdfBlocks}`
          : pdfBlocks;
      }

      if (imgAtts.length > 0 && m.role === "user") {
        return {
          role: m.role as "user" | "assistant" | "system",
          content: [
            { type: "text" as const, text: textContent },
            ...imgAtts.map((a) => ({
              type: "image_url" as const,
              image_url: { url: a.url },
            })),
          ],
        };
      }

      return {
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
      };
    }
  );

  // Recall long-term memory (best-effort) and build the base system prompt. The
  // agent/tool loop runs INSIDE the stream so its thinking + tool steps stream
  // live to the UI before the answer.
  let memoryBlock = "";
  if (!incognito && message.trim()) {
    const recalled = await recallMemories(supabase, message, 6);
    memoryBlock = formatMemoriesForPrompt(recalled);
  }
  const baseSystem = buildSystemPrompt(style) + memoryBlock;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // 1) Agentic reasoning loop — emit each thinking/tool step live.
      let observations = "";
      if (message.trim()) {
        try {
          observations = await runAgentLoop(message, (s) => send(s));
        } catch {
          observations = "";
        }
      }

      // 2) Final messages, with tool observations folded into the system prompt.
      const messages = [
        { role: "system" as const, content: baseSystem + observations },
        ...historyMessages,
      ];
      const inputTokens =
        estimateTokens(
          messages
            .map((m) =>
              typeof m.content === "string"
                ? m.content
                : m.content
                    .filter(
                      (p): p is { type: "text"; text: string } => p.type === "text"
                    )
                    .map((p) => p.text)
                    .join(" ")
            )
            .join(" ")
        ) + attachments.length * 85; // ~85 tokens per image

      // 3) Call the model for the final answer (streamed).
      let ogResponse: Response;
      try {
        if (provider.startsWith(INTEGRATE_PREFIX)) {
          const integrateModel = findIntegrateModel(provider);
          if (!integrateModel) {
            send({ content: "[Error: unknown model]" });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          ogResponse = await sendIntegratePrompt(integrateModel, messages, {
            stream: true,
          });
        } else {
          const { sendPrompt } = await import("@/lib/og-compute");
          ogResponse = await sendPrompt(provider, messages, { stream: true });
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "0G Compute unavailable";
        send({ content: `[Error: ${errMsg}]` });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      let fullResponse = "";
      const reader = ogResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                const chunk = JSON.stringify({ content });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        const errContent =
          err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ content: `\n\n[Error: ${errContent}]` })}\n\n`
          )
        );
      }

      // Calculate cost and deduct. On-chain (Integrate Network) models are
      // priced dynamically as wholesale × markup so the margin can't invert
      // when the 0G token price moves; everything else falls back to the
      // static MODEL_PRICING table.
      const outputTokens = estimateTokens(fullResponse);
      const integrateId = provider.startsWith(INTEGRATE_PREFIX)
        ? provider.slice(INTEGRATE_PREFIX.length)
        : null;
      const dynamicCost = integrateId
        ? retailCostCredits(integrateId, inputTokens, outputTokens)
        : ogRetailCostCredits(provider, inputTokens, outputTokens);
      const cost =
        dynamicCost ??
        calculateCost(model || "default", inputTokens, outputTokens);
      const actualCost = Math.max(cost, 1);

      const LOW_BALANCE_THRESHOLD = 50;
      try {
        const newBalance = await deductCredits(
          user.id,
          actualCost,
          {
            chat_id: chatId,
            model: model || "unknown",
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
          supabase
        );

        if (newBalance < LOW_BALANCE_THRESHOLD && user.email) {
          sendLowBalanceWarning(user.email, newBalance);
        }
      } catch {
        console.error("Failed to deduct credits after response");
      }

      // Save assistant message. In incognito this stays null, which cascades to
      // skip the receipt, artifact persistence, auto-title, and memory commit.
      const { data: assistantMsg } = incognito
        ? { data: null as { id: string } | null }
        : await supabase
            .from("messages")
            .insert({
              chat_id: chatId,
              role: "assistant",
              content: fullResponse,
              token_count: outputTokens,
              cost_credits: actualCost,
            })
            .select("id")
            .single();

      const emittedArtifacts: { id: string; type: string; title: string }[] = [];

      if (assistantMsg) {
        try {
          const nonce = makeNonce();
          const receipt = buildReceipt(
            {
              userId: user.id,
              chatId,
              messageId: assistantMsg.id,
              provider,
              model: model || "default",
              inputTokens,
              outputTokens,
              costCredits: actualCost,
              teeAttestation: null,
              timestamp: Math.floor(Date.now() / 1000),
              nonce,
            },
            messages,
            fullResponse
          );
          await supabase.rpc("record_receipt", {
            p_chat_id: chatId,
            p_message_id: assistantMsg.id,
            p_provider: provider,
            p_model: model || "default",
            p_input_hash: receipt.inputHash,
            p_output_hash: receipt.outputHash,
            p_input_tokens: inputTokens,
            p_output_tokens: outputTokens,
            p_cost_credits: actualCost,
            p_tee_attestation: null,
            p_nonce: nonce,
            p_receipt_hash: receipt.receiptHash,
          });
        } catch (err) {
          console.error("record_receipt failed", err);
        }

        try {
          const detected = detectArtifacts(fullResponse);
          for (const artifact of detected) {
            // Link this artifact as a revision if a previous artifact in the
            // same chat shares the same type AND title (case-insensitive).
            // This is a deliberately conservative heuristic — distinct
            // titles produce separate chains.
            let parentId: string | null = null;
            const { data: prev } = await supabase
              .from("artifacts")
              .select("id, parent_artifact_id")
              .eq("chat_id", chatId)
              .eq("type", artifact.type)
              .ilike("title", artifact.title)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (prev) {
              parentId = (prev.parent_artifact_id as string | null) ?? prev.id;
            }

            const { data: artifactId } = await supabase.rpc("record_artifact", {
              p_chat_id: chatId,
              p_message_id: assistantMsg.id,
              p_type: artifact.type,
              p_title: artifact.title,
              p_language: artifact.language,
              p_content: artifact.content,
              p_parent_artifact_id: parentId,
            });
            if (typeof artifactId === "string") {
              emittedArtifacts.push({
                id: artifactId,
                type: artifact.type,
                title: artifact.title,
              });
            }
          }
        } catch (err) {
          console.error("record_artifact failed", err);
        }
      }

      // Auto-title (skipped in incognito — there is no chat row).
      if (!incognito) {
        const { data: chatData } = await supabase
          .from("chats")
          .select("title")
          .eq("id", chatId)
          .single();

        if (chatData?.title === "New Chat") {
          await supabase
            .from("chats")
            .update({ title: message.slice(0, 50) })
            .eq("id", chatId);
        }
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost: actualCost,
            },
            messageId: assistantMsg?.id ?? null,
            artifacts: emittedArtifacts,
          })}\n\n`
        )
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      // Commit long-term memory: distill durable facts, archive to 0G Storage,
      // mirror into the searchable index. Best-effort and awaited before close
      // so the work completes within the request (serverless-safe); the client
      // already has [DONE], so this doesn't affect perceived latency.
      if (assistantMsg && fullResponse.trim()) {
        try {
          await commitMemory(supabase, {
            chatId,
            userMessage: message,
            assistantResponse: fullResponse,
            transcript: messages,
          });
        } catch (err) {
          console.error("commitMemory failed", err);
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
