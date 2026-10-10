import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAssistantMessage } from "@/lib/assistant-message";
import { keepAlive } from "@/lib/wait-until";
import { UpstreamError, type ProviderUsage } from "@/lib/upstream";
import {
  checkBalance,
  reserveCredits,
  settleCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
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
import { findOGComputeModel, ogRetailCostCredits } from "@/lib/og-compute-models";
import {
  ROUTER_PREFIX,
  findRouterModel,
  loadRouterCatalog,
  routerRetailCostCredits,
  sendRouterPrompt,
} from "@/lib/router";
import { buildReceipt, makeNonce } from "@/lib/receipts";
import { buildSystemPrompt, type ChatStyle } from "@/lib/system-prompt";
import { runAgentLoop } from "@/lib/agent";
import { detectArtifacts } from "@/lib/artifact-detect";
import { TYPICAL_OUTPUT_TOKENS } from "@/lib/estimate";
import { ThinkSplitter } from "@/lib/think-split";
import {
  recallMemories,
  formatMemoriesForPrompt,
  commitMemory,
} from "@/lib/memory";

// Reasoning models (e.g. claude-fable-5 on 0G Compute) can think for tens of
// seconds before emitting text, plus first-use on-chain settlement. Give the
// stream room so a serverless platform doesn't cut it off mid-response.
export const maxDuration = 120;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Single source of truth for "what does this answer cost?" — used to gate the
// request up front AND to settle it afterwards, so the projection can never
// disagree with the charge. On-chain (Integrate Network) models price
// dynamically as wholesale × markup so the margin can't invert when the 0G
// token price moves; everything else falls back to the static MODEL_PRICING
// table. Billing has a 1-credit floor.
function costForTokens(
  provider: string,
  model: string | undefined,
  inputTokens: number,
  outputTokens: number
): number {
  const integrateId = provider.startsWith(INTEGRATE_PREFIX)
    ? provider.slice(INTEGRATE_PREFIX.length)
    : null;
  const dynamicCost = integrateId
    ? retailCostCredits(integrateId, inputTokens, outputTokens)
    : provider.startsWith(ROUTER_PREFIX)
      ? routerRetailCostCredits(provider, inputTokens, outputTokens)
      : ogRetailCostCredits(provider, inputTokens, outputTokens);
  const cost =
    dynamicCost ??
    calculateCost(model || "default", inputTokens, outputTokens);
  return Math.max(cost, 1);
}

// Absolute floor — the cheapest an answer can ever be.
const MIN_CREDITS = 1;

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

  // Router models are priced from the live catalog, and billing looks them up
  // synchronously — load it first, and refuse ids the router doesn't list
  // (otherwise they'd silently fall through to the cheap static price table).
  // The balance read runs alongside it.
  //
  // The balance gate has to clear this answer's PROJECTED cost, not a flat
  // floor, so it fails fast with a 402 instead of opening a stream. The real
  // guarantee is the credit hold taken before the model call.
  const [, balanceRead] = await Promise.all([
    provider.startsWith(ROUTER_PREFIX) ? loadRouterCatalog() : null,
    checkBalance(user.id, supabase).catch(() => null),
  ]);
  // Unreadable balance: proceed and let the hold be the backstop rather than
  // failing a request over a transient read error.
  const balance = balanceRead ?? Number.POSITIVE_INFINITY;

  if (
    provider.startsWith(ROUTER_PREFIX)
      ? !findRouterModel(provider)
      : // Anything else is a 0G Compute provider address, and only the curated
        // ones are allowed: the broker acknowledges and funds whatever provider
        // it is handed from the shared ledger, so an arbitrary address would
        // let a caller route our 0G (and their prompts) to a provider they
        // control.
        provider.startsWith(INTEGRATE_PREFIX)
        ? !findIntegrateModel(provider)
        : !findOGComputeModel(provider)
  ) {
    return new Response(
      JSON.stringify({ error: "That model is no longer available." }),
      { status: 400 }
    );
  }

  const projectedCost = Math.max(
    costForTokens(provider, model, estimateTokens(message), TYPICAL_OUTPUT_TOKENS),
    MIN_CREDITS
  );
  if (balance < projectedCost) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits",
        balance: Number.isFinite(balance) ? balance : 0,
        required: projectedCost,
        depositUrl: "/deposit",
      }),
      { status: 402 }
    );
  }

  type HistoryRow = {
    id?: string;
    role: string;
    content: string;
    metadata?: {
      attachments?: { name?: string; type: string; url: string; extractedText?: string }[];
    };
  };

  // Save the user turn (skipped entirely in incognito — nothing is persisted).
  // A chat started from the home screen navigates with a client-made id and
  // no row yet; create it here, with its first message, so starting a chat
  // needs no round trip of its own. ON CONFLICT DO NOTHING: a retry, or an id
  // that's already taken (whose owner check then fails the insert).
  const metadata = attachments.length > 0 ? { attachments } : {};
  const saveUserTurn = async (): Promise<string | null> => {
    if (incognito) return null;
    if (body.createChat === true) {
      await supabase
        .from("chats")
        .upsert({ id: chatId, user_id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    }
    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: message,
        token_count: estimateTokens(message),
        metadata,
        ...(replacesId ? { replaces_id: replacesId } : {}),
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("insert failed");
    return data.id as string;
  };

  // Load the conversation before this turn (active branch only — soft-deleted
  // edit branches stay in the DB but are excluded from the model context).
  // Runs alongside the insert, so the new turn may or may not be in the result:
  // the caller drops it by id and appends it itself. Fetched newest-first so
  // the window is the LAST messages (ascending + limit would be the first
  // ones, and a long chat would never see the new turn), then reversed.
  // Falls back without the deleted_at filter if that migration
  // (20260520010000_message_edit_branches.sql) hasn't been applied.
  const loadHistory = async (): Promise<HistoryRow[]> => {
    if (incognito) {
      // Ephemeral: the client owns the transcript, current message included.
      // Text-only, capped to the same window as persisted chats.
      const provided = Array.isArray(body.history) ? body.history : [];
      return provided
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
    }
    const primary = await supabase
      .from("messages")
      .select("id, role, content, metadata")
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows =
      primary.error?.code === "42703"
        ? (
            await supabase
              .from("messages")
              .select("id, role, content, metadata")
              .eq("chat_id", chatId)
              .order("created_at", { ascending: false })
              .limit(50)
          ).data
        : primary.data;
    return ((rows ?? []) as HistoryRow[]).reverse();
  };

  const toModelMessage = (m: HistoryRow) => {
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
  };

  // Stop / disconnect: cancel() aborts the provider call so the generation
  // stops costing us, while run() — kept alive with waitUntil — still bills
  // and saves whatever was produced.
  const upstream = new AbortController();
  let clientGone = false;

  const run = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const encoder = new TextEncoder();
    const send = (obj: unknown) => {
      if (clientGone) return;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      } catch {
        clientGone = true;
      }
    };
    const finish = () => {
      if (clientGone) return;
      try {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        clientGone = true;
      }
    };

    // 1) Everything the answer needs, at once: save the user turn, load the
    //    history, recall long-term memory, and run the agent/tool loop (its
    //    thinking + tool steps stream live to the UI before the answer).
    const savedTurn = saveUserTurn();
    const historyP = loadHistory();
    const memoryP =
      !incognito && message.trim()
        ? recallMemories(supabase, message, 6)
            .then(formatMemoriesForPrompt)
            .catch(() => "")
        : Promise.resolve("");
    const observationsP = message.trim()
      ? runAgentLoop(message, (s) => send(s), { hasAttachments }).catch(() => "")
      : Promise.resolve("");

    let userMessageId: string | null;
    try {
      userMessageId = await savedTurn;
    } catch (err) {
      console.error("Failed to save user message", err);
      send({ error: "Couldn't save your message. Please try again.", code: "server" });
      finish();
      return;
    }
    // The client renders the user turn optimistically with a temporary id;
    // hand it the persisted one so edit/retry can supersede it.
    if (userMessageId) send({ userMessageId });

    const [historyRows, memoryBlock, observations] = await Promise.all([
      historyP.catch(() => [] as HistoryRow[]),
      memoryP,
      observationsP,
    ]);
    if (clientGone) return;

    // An assistant turn with no text (an image-generation reply, or an answer
    // that failed before producing anything) carries nothing for the model,
    // and some providers reject empty content outright.
    const turnRows = incognito
      ? historyRows
      : [
          ...historyRows.filter((m) => m.id !== userMessageId),
          { role: "user", content: message, metadata },
        ];
    const historyMessages = turnRows
      .filter((m) => m.role !== "assistant" || m.content.trim())
      .map(toModelMessage);

    // 2) Final messages. The system prompt and earlier turns are byte-stable
    //    from one turn to the next, so providers can serve that prefix from
    //    their prompt cache (faster first token, cheaper input). Everything
    //    specific to this turn — recalled memory and tool results, which carry
    //    the current time — rides on the latest user message instead of the
    //    system prompt, where it would change the prefix every time.
    const turnContext = `${memoryBlock}${observations}`.trim();
    const last = historyMessages[historyMessages.length - 1];
    if (turnContext && last?.role === "user") {
      const prefix = `${turnContext}\n\n---\n\n`;
      historyMessages[historyMessages.length - 1] =
        typeof last.content === "string"
          ? { ...last, content: prefix + last.content }
          : { ...last, content: [{ type: "text" as const, text: prefix }, ...last.content] };
    }

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(style) },
      ...historyMessages,
    ];
    const estimatedInputTokens =
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

    // 3) Reserve the projected cost on the REAL input size (history, system
    //    prompt and tool observations dwarf the raw message) before spending
    //    anything on inference. The hold is swapped for the actual cost below,
    //    so neither a disconnect nor a burst of parallel requests gets a free
    //    answer.
    const projectedNow = Math.max(
      costForTokens(provider, model, estimatedInputTokens, TYPICAL_OUTPUT_TOKENS),
      MIN_CREDITS
    );
    let holdId: string;
    try {
      holdId = await reserveCredits(user.id, projectedNow, {
        chat_id: chatId,
        model: model || "unknown",
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        send({
          error: "Insufficient credits",
          code: "insufficient_credits",
          balance: Number.isFinite(balance) ? balance : 0,
          required: projectedNow,
          depositUrl: "/deposit",
        });
      } else {
        console.error("reserveCredits failed", err);
        send({ error: "Couldn't start this answer. Please try again.", code: "server" });
      }
      finish();
      return;
    }

    // 4) Call the model for the final answer (streamed).
    let ogResponse: Response;
    try {
      const opts = { stream: true, signal: upstream.signal };
      if (provider.startsWith(INTEGRATE_PREFIX)) {
        ogResponse = await sendIntegratePrompt(findIntegrateModel(provider)!, messages, opts);
      } else if (provider.startsWith(ROUTER_PREFIX)) {
        ogResponse = await sendRouterPrompt(findRouterModel(provider)!, messages, opts);
      } else {
        const { sendPrompt } = await import("@/lib/og-compute");
        ogResponse = await sendPrompt(provider, messages, opts);
      }
    } catch (err) {
      await settleCredits(holdId, 0).catch((e) =>
        console.error("Failed to release credit hold", e)
      );
      if (!clientGone) {
        console.error("model call failed", err);
        send({
          error:
            err instanceof UpstreamError
              ? err.message
              : "The model is unavailable right now. Try again, or pick another model.",
          code: "upstream",
        });
      }
      finish();
      return;
    }

    let fullResponse = "";
    // Model reasoning is streamed to the UI as `{ reasoning }` events but is
    // not part of the answer: it isn't saved or hashed into the receipt. It
    // IS billed — providers charge reasoning as output tokens. It arrives as
    // delta.reasoning_content / .reasoning, or inline as <think>…</think>
    // (split out here).
    let reasoningText = "";
    const sendReasoning = (text: string) => {
      reasoningText += text;
      send({ reasoning: text });
    };
    // glm-5.1-fp8 (Integrate) ignores enable_thinking:false and streams its
    // reasoning as plain content up to a bare </think> — treat everything
    // before that as reasoning rather than showing it as the answer.
    const implicitThink = provider.startsWith(INTEGRATE_PREFIX);
    const think = new ThinkSplitter({ startInThink: implicitThink });
    const emit = ({ content, reasoning }: { content: string; reasoning: string }) => {
      if (reasoning) sendReasoning(reasoning);
      if (content) {
        fullResponse += content;
        send({ content });
      }
    };
    const reader = ogResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // What the provider reported, when it did: real token counts and why it
    // stopped ("length" = cut off at the output limit).
    let usage: ProviderUsage | null = null;
    let finishReason: string | null = null;
    let streamError: string | null = null;

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

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue; // skip malformed chunks
          }
          if (parsed.error) {
            console.error("upstream stream error", parsed.error);
            streamError = "The model stopped with an error partway through.";
            continue;
          }
          if (parsed.usage) {
            usage = {
              inputTokens: Number(parsed.usage.prompt_tokens) || 0,
              outputTokens: Number(parsed.usage.completion_tokens) || 0,
            };
          }
          const choice = parsed.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          const delta = choice?.delta ?? {};
          const reasoning = delta.reasoning_content || delta.reasoning || "";
          if (typeof reasoning === "string" && reasoning) {
            sendReasoning(reasoning);
          }
          const content = delta.content || "";
          if (content) emit(think.push(content));
        }
      }
    } catch (err) {
      // Either the user stopped (we aborted the body) or the provider dropped.
      if (!clientGone) {
        console.error("upstream stream read failed", err);
        streamError = "The connection to the model dropped partway through.";
      }
    }
    const stopped = clientGone;

    emit(think.flush());
    // No </think> ever came, so there was no reasoning: what streamed as
    // "reasoning" was the answer. Move it back (server + client).
    if (implicitThink && !think.sawClose && reasoningText) {
      fullResponse = reasoningText + fullResponse;
      reasoningText = "";
      send({ promoteReasoning: true });
    }

    // 5) Settle: bill on the provider's token counts when it reported them,
    //    else on the estimate. Reasoning counts as output. Nothing produced
    //    (the model failed before answering) means a full refund.
    const produced = fullResponse.length > 0 || reasoningText.length > 0;
    const inputTokens = usage?.inputTokens || estimatedInputTokens;
    const outputTokens =
      usage?.outputTokens || estimateTokens(fullResponse + reasoningText);
    const actualCost = produced
      ? costForTokens(provider, model, inputTokens, outputTokens)
      : 0;

    const LOW_BALANCE_THRESHOLD = 50;
    try {
      const settlement = await settleCredits(holdId, actualCost, {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        usage_source: usage ? "provider" : "estimate",
        ...(stopped ? { stopped: true } : {}),
      });
      if (
        settlement.new_balance !== undefined &&
        settlement.new_balance < LOW_BALANCE_THRESHOLD &&
        user.email
      ) {
        sendLowBalanceWarning(user.email, settlement.new_balance);
      }
    } catch (err) {
      // The hold stays in place and the cron refunds it; log for follow-up.
      console.error("Failed to settle credits after response", err);
    }

    // 6) Save the answer — partial answers too (stopped or cut off), so what
    //    the user saw survives a reload. Empty answers aren't saved: they'd
    //    become empty turns that some providers reject. In incognito this
    //    stays null, which skips the receipt, artifacts, title and memory.
    //    Assistant rows and receipts are service-role only, so a user can't
    //    write an answer the model never gave and get it receipted.
    const assistantMsg =
      incognito || !fullResponse
        ? null
        : await saveAssistantMessage(user.id, chatId, {
            content: fullResponse,
            token_count: outputTokens,
            cost_credits: actualCost,
            ...(stopped || streamError || finishReason === "length"
              ? {
                  metadata: {
                    incomplete: stopped ? "stopped" : streamError ? "error" : "length",
                  },
                }
              : {}),
          }).catch((err) => {
            console.error("Failed to save assistant message", err);
            return null;
          });

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
        const { error: receiptError } = await createAdminClient().rpc("record_receipt", {
          p_user_id: user.id,
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
        if (receiptError) throw receiptError;
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

    if (streamError) send({ error: streamError, code: "upstream" });
    send({
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: actualCost,
      },
      finishReason,
      messageId: assistantMsg?.id ?? null,
      artifacts: emittedArtifacts,
    });
    finish();

    // Commit long-term memory: distill durable facts, archive to 0G Storage,
    // mirror into the searchable index. Best-effort; the client already has
    // [DONE], so this doesn't affect perceived latency. Only complete answers
    // are worth remembering.
    if (assistantMsg && !stopped && !streamError) {
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
  };

  const stream = new ReadableStream({
    start(controller) {
      keepAlive(run(controller));
    },
    cancel() {
      clientGone = true;
      upstream.abort();
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
