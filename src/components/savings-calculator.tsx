"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Marketing calculator: a flat AI subscription vs paying only for what you ask.
// Numbers use the real GLM 5.1 retail price and the live USD→NGN rate, so the
// comparison is honest and self-updating — it's the user's OWN usage, not a
// claim we assert.
//
// ~3.6 credits/question ≈ 800 input + 400 output tokens at 1.5 / 6 credits per
// 1k (see lib/pricing). 1000 credits = $1.
const CREDITS_PER_QUESTION = 3.6;
const SUBSCRIPTION_USD = 20; // ChatGPT Plus / Claude Pro
const FALLBACK_NGN = 1376;
const ACCENT = "#CB8AFF";

export function SavingsCalculator() {
  const [qpd, setQpd] = useState(15);
  const [rate, setRate] = useState(FALLBACK_NGN);
  const [ngn, setNgn] = useState(true);

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.rate === "number" && d.rate > 0) setRate(d.rate);
      })
      .catch(() => {});
  }, []);

  const { youUsd, subUsd, saveYearUsd } = useMemo(() => {
    const monthlyCredits = qpd * 30 * CREDITS_PER_QUESTION;
    const youUsd = monthlyCredits / 1000;
    return {
      youUsd,
      subUsd: SUBSCRIPTION_USD,
      saveYearUsd: Math.max(0, (SUBSCRIPTION_USD - youUsd) * 12),
    };
  }, [qpd]);

  const money = (usd: number) =>
    ngn
      ? `₦${Math.round(usd * rate).toLocaleString()}`
      : `$${usd.toFixed(2)}`;

  return (
    <section
      id="savings"
      className="relative border-t border-white/10 bg-black px-6 py-20 text-white md:py-28"
    >
      <div className="mx-auto w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            pay by the question, not the month
          </p>
          <h2 className="font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl md:text-5xl">
            Stop paying for AI you don&apos;t use
          </h2>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-white/55">
            A subscription charges one flat price whether you ask 3 questions or
            300. Here, you only pay for the ones you actually ask.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
        >
          {/* Slider */}
          <div className="flex items-center justify-between">
            <label htmlFor="qpd" className="text-[13px] font-medium text-white/60">
              How many questions a day?
            </label>
            <button
              onClick={() => setNgn((v) => !v)}
              className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:text-white"
            >
              {ngn ? "₦ NGN" : "$ USD"}
            </button>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="font-display text-4xl font-bold tabular-nums"
              style={{ color: ACCENT }}
            >
              {qpd}
            </span>
            <span className="text-[13px] text-white/40">questions / day</span>
          </div>

          <input
            id="qpd"
            type="range"
            min={1}
            max={120}
            value={qpd}
            onChange={(e) => setQpd(Number(e.target.value))}
            className="mt-3 w-full accent-[#CB8AFF]"
          />

          {/* Result */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                You, pay-as-you-go
              </p>
              <p
                className="mt-1.5 font-display text-2xl font-bold tabular-nums md:text-3xl"
                style={{ color: ACCENT }}
              >
                {money(youUsd)}
                <span className="text-[13px] font-medium text-white/40">/mo</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-transparent p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Flat subscription
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white/45 line-through decoration-white/25 md:text-3xl">
                {money(subUsd)}
                <span className="text-[13px] font-medium text-white/30">/mo</span>
              </p>
            </div>
          </div>

          {saveYearUsd > 0 && (
            <p className="mt-5 text-center text-[15px] text-white/70">
              That&apos;s{" "}
              <span className="font-bold text-white">{money(saveYearUsd)}</span>{" "}
              back in your pocket every year.
            </p>
          )}

          <div className="mt-7 flex justify-center">
            <Link
              href="/signup"
              className="press group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-black transition-[background-color,transform] duration-fast ease-out hover:bg-white/90"
            >
              start free — pay only when you ask
              <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>

        <p className="mx-auto mt-5 max-w-lg text-center text-[11px] leading-relaxed text-white/30">
          Estimate at current rates — you pay for the tokens you use, no
          subscription. Heavier users pay more but are never locked in. New
          accounts start with free credits.
        </p>
      </div>
    </section>
  );
}
