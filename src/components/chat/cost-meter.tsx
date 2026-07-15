"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrency } from "@/lib/currency";
import { estimateCredits } from "@/lib/estimate";

// The pre-send cost meter. Shows a live "~₦2" estimate for the pending message
// (in the user's currency) plus a running "₦18 today" total, so pay-per-use
// billing feels like control instead of an unpredictable meter.
export function CostMeter({
  promptText,
  model,
  hasAttachments,
  isStreaming,
}: {
  promptText: string;
  model?: string;
  hasAttachments?: boolean;
  isStreaming?: boolean;
}) {
  const { formatCost } = useCurrency();
  const [creditsToday, setCreditsToday] = useState<number | null>(null);
  const wasStreaming = useRef(false);

  const loadToday = () => {
    fetch("/api/spend/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.creditsToday === "number") setCreditsToday(d.creditsToday);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadToday();
  }, []);

  // Refresh the running total as soon as a message finishes streaming (i.e. a
  // charge just landed), without touching the send flow.
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) loadToday();
    wasStreaming.current = !!isStreaming;
  }, [isStreaming]);

  const hasDraft = !!promptText.trim() || !!hasAttachments;
  const estimate = hasDraft ? estimateCredits(model ?? "", promptText) : 0;

  if (!hasDraft && creditsToday == null) return null;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-text-tertiary">
      {hasDraft && (
        <span
          className="whitespace-nowrap"
          title="Estimated cost — you're billed for the actual tokens used."
        >
          ~{formatCost(estimate)}
        </span>
      )}
      {hasDraft && creditsToday != null && (
        <span className="text-text-tertiary/40">·</span>
      )}
      {creditsToday != null && (
        <span
          className="whitespace-nowrap"
          title="Total you've spent today."
        >
          {formatCost(creditsToday)} today
        </span>
      )}
    </span>
  );
}
