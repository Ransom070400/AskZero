"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SavingsCalculator } from "@/components/savings-calculator";
import { ReceiptHero } from "@/components/landing/receipt-hero";
import { MerkleSection } from "@/components/landing/merkle-section";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.25 + delay * 0.12,
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
});

export default function LandingPage() {
  return (
    <div className="relative bg-ink text-white">
      {/* Hero screen */}
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
        <AmbientGlow />

      {/* Nav — single text link, no chrome */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-20 flex items-center justify-between px-6 md:px-10 py-6"
      >
        <Logo size={22} animated className="text-white" />
        <Link
          href="/login"
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/55 transition-colors duration-fast ease-out hover:text-white"
        >
          sign in
        </Link>
      </motion.header>

      {/* Hero — copy on the left, the live receipt on the right. Stacks on
          mobile with the receipt under the CTA. */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-4 px-6 pb-10 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-0">
        <div className="space-y-7 text-center lg:space-y-9 lg:text-left">
          <motion.p
            {...fade(0)}
            className="text-xs font-medium text-white/45"
          >
            verifiable AI on 0G
          </motion.p>

          <motion.h1
            {...fade(1)}
            className="font-display text-[44px] font-bold leading-[0.95] sm:text-6xl md:text-7xl lg:text-5xl xl:text-[80px]"
            style={{ letterSpacing: "-0.045em" }}
          >
            AI answers
            <br />
            <span className="text-accent-hover">you can verify.</span>
          </motion.h1>

          <motion.p
            {...fade(2)}
            className="mx-auto max-w-md text-base leading-relaxed text-white/55 md:text-[17px] lg:mx-0"
          >
            each response gets a tamper-evident receipt anchored on 0G. pay only
            when you use it.
          </motion.p>

          <motion.div
            {...fade(3)}
            className="flex flex-col items-center gap-4 pt-1 sm:flex-row sm:justify-center lg:justify-start"
          >
            <Link
              href="/signup"
              className="press group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-md font-semibold text-black transition-[background-color,transform] duration-fast ease-out hover:bg-white/90"
            >
              ask your first question free
              <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1 text-xs font-medium text-white/40 transition-colors duration-fast hover:text-white/75"
            >
              how the proof works ↓
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <ReceiptHero />
          <p className="-mt-2 text-center text-2xs text-white/30">
            drag to turn it over
          </p>
        </motion.div>
      </main>
      </div>

      {/* How the proof works — scroll-driven Merkle tree */}
      <MerkleSection />

      {/* Savings calculator — the marketing point */}
      <SavingsCalculator />

      {/* Footer — minimal, single line */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="relative z-10 flex items-center justify-center gap-2 px-6 py-8 text-2xs font-medium tracking-[0.18em] text-white/30"
      >
        <span>askzero</span>
        <span className="h-1 w-1 rounded-full bg-white/15" />
        <span>built on 0G</span>
      </motion.footer>
    </div>
  );
}

/**
 * Ambient backdrop — pure CSS, no canvas. Two slow-drifting accent radials
 * over deep black. Calm, never noisy.
 */
function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute left-1/2 top-[55%] h-[900px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--accent) / 0.2) 0%, hsl(var(--accent) / 0.05) 40%, transparent 70%)",
          animation: "ambientDrift 16s var(--ease-in-out) infinite",
        }}
      />
      <div
        className="absolute left-[20%] top-[20%] h-[480px] w-[480px] rounded-full opacity-40 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--accent-hover) / 0.12) 0%, transparent 70%)",
          animation: "ambientDrift2 22s var(--ease-in-out) infinite",
        }}
      />
      {/* Subtle grain — optional, very low opacity */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
