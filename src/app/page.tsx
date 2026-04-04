"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, Zap, Shield, Globe, ArrowRight } from "lucide-react";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { delay: delay * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
});

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-foreground" />
          <span className="text-base font-semibold tracking-tight">AskZero</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-text-secondary hover:text-foreground transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-accent-hover"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[10%] left-[15%] h-[500px] w-[500px] rounded-full bg-[#8B7FFF] opacity-[0.15] dark:opacity-[0.12] blur-[100px] animate-blob" />
          <div className="absolute top-[20%] right-[10%] h-[400px] w-[400px] rounded-full bg-[#6366F1] opacity-[0.12] dark:opacity-[0.10] blur-[100px] animate-blob [animation-delay:2s]" />
          <div className="absolute bottom-[10%] left-[30%] h-[450px] w-[450px] rounded-full bg-[#A78BFA] opacity-[0.12] dark:opacity-[0.08] blur-[100px] animate-blob [animation-delay:4s]" />
        </div>
        <div className="max-w-2xl text-center space-y-6">
          <motion.p
            {...fade(0)}
            className="text-micro uppercase text-text-tertiary tracking-widest"
          >
            Powered by 0G Network
          </motion.p>

          <motion.h1
            {...fade(1)}
            className="text-3xl font-semibold tracking-tight sm:text-3xl"
          >
            AI inference, decentralized.
          </motion.h1>

          <motion.p
            {...fade(2)}
            className="mx-auto max-w-md text-base text-text-secondary"
          >
            Chat with AI on a decentralized compute network. Pay with Naira, USD, or 0G tokens. Only pay for what you use.
          </motion.p>

          <motion.div {...fade(3)} className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-accent-hover"
            >
              Start chatting
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.p {...fade(4)}>
            <Link
              href="/login"
              className="text-sm text-text-tertiary hover:text-accent transition-colors duration-150"
            >
              Already have an account? Sign in
            </Link>
          </motion.p>
        </div>

        {/* Features */}
        <motion.div
          {...fade(5)}
          className="mt-24 mb-16 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-3"
        >
          {[
            {
              icon: Zap,
              title: "Fast inference",
              desc: "Streaming responses from decentralized GPU providers.",
            },
            {
              icon: Shield,
              title: "Verifiable",
              desc: "TEE-verified compute ensures authentic responses.",
            },
            {
              icon: Globe,
              title: "Pay your way",
              desc: "Naira, USD, or 0G tokens. No subscriptions.",
            },
          ].map((f) => (
            <div key={f.title} className="text-center sm:text-left">
              <f.icon className="mx-auto mb-3 h-4 w-4 text-text-tertiary sm:mx-0" />
              <h3 className="text-sm font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-6 py-6 text-micro uppercase text-text-tertiary tracking-widest">
        <span>&copy; {new Date().getFullYear()} AskZero</span>
      </footer>
    </div>
  );
}
