"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SavingsCalculator } from "@/components/savings-calculator";

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
    <div className="relative bg-black text-white">
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
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/55 transition-colors duration-fast ease-out hover:text-white"
        >
          sign in
        </Link>
      </motion.header>

      {/* Hero — vertically centered, generous breathing room */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-3xl space-y-8 md:space-y-10">
          <motion.p
            {...fade(0)}
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40"
          >
            decentralized AI
          </motion.p>

          <motion.h1
            {...fade(1)}
            className="font-display text-[44px] font-bold leading-[0.95] sm:text-6xl md:text-7xl lg:text-[112px]"
            style={{ letterSpacing: "-0.045em" }}
          >
            the future of ai
            <br />
            <span style={{ color: "#CB8AFF" }}>is decentralized.</span>
          </motion.h1>

          <motion.p
            {...fade(2)}
            className="mx-auto max-w-md text-[15px] leading-relaxed text-white/55 md:text-[17px]"
          >
            private, verifiable AI. no subscriptions.
          </motion.p>

          <motion.div
            {...fade(3)}
            className="flex flex-col items-center gap-4 pt-2"
          >
            <Link
              href="/signup"
              className="press group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-black transition-[background-color,transform] duration-fast ease-out hover:bg-white/90"
            >
              get started
              <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          <motion.a
            {...fade(4)}
            href="#savings"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-white/35 transition-colors duration-fast hover:text-white/70"
          >
            see how much you&apos;d save ↓
          </motion.a>
        </div>
      </main>
      </div>

      {/* Savings calculator — the marketing point */}
      <SavingsCalculator />

      {/* Footer — minimal, single line */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="relative z-10 flex items-center justify-center gap-2 px-6 py-8 text-[11px] font-medium tracking-[0.18em] text-white/30"
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
            "radial-gradient(circle at center, rgba(183, 95, 255, 0.30) 0%, rgba(183, 95, 255, 0.08) 40%, transparent 70%)",
          animation: "ambientDrift 16s var(--ease-in-out) infinite",
        }}
      />
      <div
        className="absolute left-[20%] top-[20%] h-[480px] w-[480px] rounded-full opacity-40 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(203, 138, 255, 0.18) 0%, transparent 70%)",
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
