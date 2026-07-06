"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Loader2, X, Copy, Check, ExternalLink } from "lucide-react";

// Fallback 0G mainnet explorer if NEXT_PUBLIC_ZERO_G_EXPLORER_URL isn't wired
// into the API response.
const DEFAULT_EXPLORER = "https://chainscan.0g.ai";

interface ReceiptResponse {
  receipt: {
    provider: string;
    model: string;
    input_hash: string;
    output_hash: string;
    input_tokens: number;
    output_tokens: number;
    cost_credits: number;
    tee_attestation: string | null;
    receipt_hash: string;
    status: string;
    leaf_index: number | null;
    created_at: string;
  };
  batch: {
    merkle_root: string;
    leaf_count: number;
    chain_id: number;
    contract_addr: string;
    tx_hash: string | null;
    block_number: number | null;
    status: string;
    confirmed_at: string | null;
  } | null;
  explorerUrl: string | null;
}

export function ReceiptBadge({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">("idle");

  const load = async () => {
    setOpen(true);
    if (data || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch(`/api/receipts/${messageId}`);
      if (res.status === 404) return setState("none");
      if (!res.ok) return setState("error");
      setData((await res.json()) as ReceiptResponse);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const anchored = !!data?.batch?.tx_hash;

  return (
    <>
      <button
        onClick={load}
        className="press inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:text-accent"
        title="Verify this answer on 0G"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Verify on 0G
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Inference receipt"
              className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-elevated shadow-xl"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={anchored ? "h-5 w-5 text-success" : "h-5 w-5 text-accent"}
                  />
                  <div>
                    <p className="text-[14px] font-bold text-foreground">
                      {anchored ? "Verified on 0G" : "Inference receipt"}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      Tamper-evident proof of this answer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="press text-text-tertiary hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-4">
                {state === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-10 text-text-tertiary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-[13px]">Loading proof…</span>
                  </div>
                )}
                {state === "none" && (
                  <p className="py-8 text-center text-[13px] text-text-secondary">
                    No receipt was recorded for this message.
                  </p>
                )}
                {state === "error" && (
                  <p className="py-8 text-center text-[13px] text-error">
                    Couldn&apos;t load the receipt. Please try again.
                  </p>
                )}

                {data && (
                  <div className="space-y-5">
                    <p className="text-[13px] leading-relaxed text-text-secondary">
                      AskZero fingerprints this answer&apos;s inputs and outputs and
                      anchors the hash on the 0G chain, so it can&apos;t be altered
                      after the fact.
                    </p>

                    <Group label="Status">
                      <StatusRow ok label="Receipt created" />
                      {anchored ? (
                        <StatusRow
                          ok
                          label="Anchored on-chain"
                          note={
                            data.batch?.block_number
                              ? `block ${data.batch.block_number}`
                              : undefined
                          }
                        />
                      ) : (
                        <StatusRow
                          label="On-chain anchor"
                          note="pending next batch (anchored hourly)"
                        />
                      )}
                      {data.receipt.tee_attestation && (
                        <StatusRow ok label="TEE attestation present" />
                      )}
                    </Group>

                    <Group label="Model">
                      <KV k="Provider" v={data.receipt.provider} />
                      <KV k="Model" v={data.receipt.model} />
                      <KV
                        k="Tokens"
                        v={`${data.receipt.input_tokens} in · ${data.receipt.output_tokens} out · ${data.receipt.cost_credits}c`}
                      />
                    </Group>

                    <Group label="Cryptographic proof">
                      <Hash k="Input hash" v={data.receipt.input_hash} />
                      <Hash k="Output hash" v={data.receipt.output_hash} />
                      <Hash
                        k={
                          data.receipt.leaf_index != null
                            ? `Receipt hash (leaf #${data.receipt.leaf_index})`
                            : "Receipt hash"
                        }
                        v={data.receipt.receipt_hash}
                      />
                      {data.batch && (
                        <Hash k="Merkle root" v={data.batch.merkle_root} />
                      )}
                    </Group>

                    {data.batch && (
                      <Group label="On-chain">
                        <KV k="Chain" v={`${data.batch.chain_id} (0G)`} />
                        <Hash k="Registry" v={data.batch.contract_addr} />
                        {data.batch.tx_hash && (
                          <Hash k="Anchor tx" v={data.batch.tx_hash} />
                        )}
                        {data.batch.tx_hash && (
                          <a
                            href={
                              data.explorerUrl ||
                              `${DEFAULT_EXPLORER}/tx/${data.batch.tx_hash}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="press mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:bg-accent/20"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View transaction on 0G explorer
                          </a>
                        )}
                      </Group>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="text-text-tertiary">{k}</span>
      <span className="text-right font-medium text-foreground">{v}</span>
    </div>
  );
}

function StatusRow({ ok, label, note }: { ok?: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        className={
          ok
            ? "flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-success"
            : "flex h-4 w-4 items-center justify-center rounded-full bg-surface text-text-tertiary"
        }
      >
        {ok ? <Check className="h-2.5 w-2.5" /> : <Loader2 className="h-2.5 w-2.5" />}
      </span>
      <span className="text-foreground">{label}</span>
      {note && <span className="text-text-tertiary">· {note}</span>}
    </div>
  );
}

function Hash({ k, v }: { k: string; v: string }) {
  const [copied, setCopied] = useState(false);
  const short = v.length > 18 ? `${v.slice(0, 10)}…${v.slice(-8)}` : v;
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="shrink-0 text-text-tertiary">{k}</span>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(v);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="press inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-accent"
        title="Copy"
      >
        {short}
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 opacity-50" />}
      </button>
    </div>
  );
}
