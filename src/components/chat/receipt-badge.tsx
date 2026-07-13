"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { keccak256, toUtf8Bytes } from "ethers";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
  Copy,
  Check,
  ExternalLink,
  Wand2,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

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
  chainName: string | null;
  // The exact persisted answer text that output_hash was computed over. The
  // tamper demo hashes this (not the client's streamed copy, which can drift).
  output: string | null;
}

interface VerifyResult {
  status: string;
  computedRoot?: string;
  merkleRoot?: string;
  rootMatches?: boolean;
  onChain?: boolean | null;
  proofLength?: number;
  contractUrl?: string;
}

const PROOF_MOMENT_KEY = "askzero-proof-moment-seen";
// Hidden for now — flip to true to re-enable the interactive tamper demo +
// first-answer callout. The rest of the receipt/verify modal is unaffected.
const PROOF_MOMENT_ENABLED = false;

export function ReceiptBadge({
  messageId,
  content,
  spotlight,
}: {
  messageId: string;
  content?: string;
  spotlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">("idle");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  // Default true so the first-answer callout never flashes before we've read
  // localStorage; the effect flips it to the real value on mount.
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    try {
      setSeen(!!localStorage.getItem(PROOF_MOMENT_KEY));
    } catch {
      setSeen(true);
    }
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(PROOF_MOMENT_KEY, "1");
    } catch {
      /* private mode — fine, it just shows again next time */
    }
    setSeen(true);
  };

  const showCallout = PROOF_MOMENT_ENABLED && !!spotlight && !seen && !!content;

  const runVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/receipts/${messageId}/verify`);
      setVerify((await res.json()) as VerifyResult);
    } catch {
      setVerify({ status: "error" });
    } finally {
      setVerifying(false);
    }
  };

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
      <span className="relative inline-flex items-center gap-1.5">
        <button
          onClick={load}
          className="press inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:text-accent"
          title="This answer has a tamper-proof receipt — tap to see it"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified
        </button>

        {showCallout && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-accent"
          >
            <button
              onClick={() => {
                markSeen();
                load();
              }}
              className="press inline-flex items-center gap-1"
            >
              See why this can&apos;t be faked
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={markSeen}
              aria-label="Dismiss"
              className="press text-accent/60 hover:text-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        )}
      </span>

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
                      This is a unique fingerprint of your exact question and
                      answer. Change a single character and the fingerprint no
                      longer matches — so you can prove this is the original
                      answer, untampered. (The technical details are below.)
                    </p>

                    {PROOF_MOMENT_ENABLED && (data.output ?? content) && (
                      <TamperDemo
                        original={(data.output ?? content)!}
                        outputHash={data.receipt.output_hash}
                      />
                    )}

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
                        <KV k="Network" v={data.chainName || `chain ${data.batch.chain_id}`} />
                        <Hash k="Registry" v={data.batch.contract_addr} />
                        {data.batch.tx_hash && (
                          <Hash k="Anchor tx" v={data.batch.tx_hash} />
                        )}
                        <p className="pt-1 text-[11px] leading-relaxed text-text-tertiary">
                          Only the batch&apos;s Merkle root is stored on-chain —
                          individual receipts aren&apos;t, so you won&apos;t find
                          this receipt on the explorer directly. Instead, verify
                          it&apos;s part of the anchored batch below.
                        </p>
                        {data.explorerUrl && (
                          <a
                            href={data.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="press mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:bg-accent/20"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View anchoring transaction
                          </a>
                        )}
                      </Group>
                    )}

                    {data.batch && (
                      <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-foreground">
                              Prove it hasn&apos;t been tampered with
                            </p>
                            <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">
                              Re-derives this answer&apos;s Merkle root and checks
                              it live against 0G.
                            </p>
                          </div>
                          <button
                            onClick={runVerify}
                            disabled={verifying}
                            className="press shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
                          >
                            {verifying ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                            Verify
                          </button>
                        </div>

                        {verify && verify.status === "anchored" && (
                          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                            <StatusRow
                              ok={verify.rootMatches}
                              label="Receipt + proof re-derive the anchored root"
                              note={`${verify.proofLength} proof steps`}
                            />
                            <StatusRow
                              ok={!!verify.onChain}
                              label="Root confirmed on the live 0G chain"
                              note={verify.onChain ? "isAnchored() = true" : "not found"}
                            />
                            <p className="pt-1 text-[12px] leading-relaxed text-text-secondary">
                              {verify.rootMatches && verify.onChain
                                ? "✓ Tamper-proof — altering a single character of this answer would change its hash, break the proof, and no longer match the root anchored on-chain."
                                : "This receipt could not be fully verified."}
                            </p>
                            {verify.contractUrl && (
                              <a
                                href={verify.contractUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="press inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View registry contract on 0G
                              </a>
                            )}
                          </div>
                        )}
                        {verify && verify.status === "pending" && (
                          <p className="mt-3 border-t border-border/60 pt-3 text-[12px] text-text-tertiary">
                            Not anchored on-chain yet — receipts are batched hourly.
                            Check back shortly.
                          </p>
                        )}
                        {verify && verify.status === "error" && (
                          <p className="mt-3 border-t border-border/60 pt-3 text-[12px] text-error">
                            Verification failed to run. Please try again.
                          </p>
                        )}
                      </div>
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

// Interactive proof-of-integrity demo. Recomputes the answer's fingerprint
// client-side with the SAME function the server used (output_hash =
// keccak256(utf8(answer)) — see lib/receipts.hashText), so the "matches" state
// is a real recomputation, not a mock. Edit the text → the hash diverges →
// the check goes red. This is the visceral "watch it break" moment.
function TamperDemo({
  original,
  outputHash,
}: {
  original: string;
  outputHash: string;
}) {
  const [text, setText] = useState(original);

  useEffect(() => {
    setText(original);
  }, [original]);

  const liveHash = useMemo(() => {
    try {
      return keccak256(toUtf8Bytes(text));
    } catch {
      return "";
    }
  }, [text]);

  const originalHash = useMemo(() => {
    try {
      return keccak256(toUtf8Bytes(original));
    } catch {
      return "";
    }
  }, [original]);

  // Normally the stored answer reproduces the anchored output_hash, so we match
  // against that (rigorous). If it doesn't — a legacy/edited message whose text
  // drifted from what was hashed — fall back to the original's own hash so the
  // untampered state is never falsely flagged as tampered.
  const baseline =
    originalHash.toLowerCase() === outputHash.toLowerCase() ? outputHash : originalHash;
  const matches = liveHash.toLowerCase() === baseline.toLowerCase();
  const tampered = text !== original;
  const shortHash =
    liveHash.length > 18 ? `${liveHash.slice(0, 10)}…${liveHash.slice(-8)}` : liveHash;

  // Flip the first letter/digit to something guaranteed different.
  const tamperForMe = () => {
    const idx = text.search(/[A-Za-z0-9]/);
    if (idx === -1) {
      setText(`${text}.`);
      return;
    }
    const ch = text[idx];
    const alt = /[0-9]/.test(ch)
      ? ch === "0"
        ? "1"
        : "0"
      : ch.toLowerCase() === "a"
        ? "e"
        : "a";
    const cased = ch === ch.toUpperCase() ? alt.toUpperCase() : alt;
    setText(text.slice(0, idx) + cased + text.slice(idx + 1));
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div>
        <p className="text-[13px] font-semibold text-foreground">See it yourself</p>
        <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">
          Edit the answer below and watch its fingerprint change — that&apos;s why a
          single altered character breaks the proof.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-28 w-full resize-none rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-border-strong"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[12px] text-text-tertiary">
          {shortHash}
        </span>
        <span
          className={
            matches
              ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"
              : "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-error/15 px-2.5 py-1 text-[11px] font-semibold text-error"
          }
        >
          {matches ? (
            <>
              <Check className="h-3 w-3" /> Matches the original
            </>
          ) : (
            <>
              <ShieldAlert className="h-3 w-3" /> Tampered — won&apos;t verify
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={tamperForMe}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-elevated px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-border-strong"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Tamper for me
        </button>
        <button
          onClick={() => setText(original)}
          disabled={!tampered}
          className="press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-text-secondary hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restore
        </button>
      </div>
    </div>
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
