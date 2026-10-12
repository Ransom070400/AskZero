"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, BriefcaseBusiness, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SavingsCalculator } from "@/components/savings-calculator";

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-ink text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 md:px-10">
        <Logo size={22} animated className="text-white" />
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <a href="#pricing" className="hidden text-white/60 transition-colors hover:text-white sm:inline">Pricing</a>
          <a href="#why-askzero" className="hidden text-white/60 transition-colors hover:text-white md:inline">Why AskZero</a>
          <Link href="/login" className="text-white/70 transition-colors hover:text-white">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-7 sm:px-8 sm:pb-20 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:pb-28 lg:pt-16">
          <div className="relative z-10">
            <motion.p {...reveal(0.05)} className="text-sm font-semibold text-accent-hover">AI that fits your day</motion.p>
            <motion.h1 {...reveal(0.12)} className="mt-4 max-w-xl font-display text-4xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-[64px]">Ask more. Pay less.</motion.h1>
            <motion.p {...reveal(0.2)} className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              AskZero helps you write, learn, plan, research, and create. There is no monthly subscription. You only pay for what you use.
            </motion.p>
            <motion.div {...reveal(0.28)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="press inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-md font-semibold text-ink transition-colors hover:bg-white/90">
                Try AskZero free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing" className="press inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-md font-semibold text-white transition-colors hover:border-white/45 hover:bg-white/5">
                See what you could pay
              </a>
            </motion.div>
            <motion.p {...reveal(0.34)} className="mt-4 text-sm text-white/50">Start free. Add credit only when you need it.</motion.p>
          </div>

          <motion.div {...reveal(0.18)} className="relative mx-auto w-full max-w-[620px] lg:max-w-none">
            <div className="relative aspect-[1.16] overflow-hidden rounded-[28px] border border-white/15 bg-white/5 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
              <Image src="/images/askzero-everyday-ai-hero.png" alt="A woman using AskZero while studying and working at home" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                <p className="max-w-sm text-lg font-semibold leading-snug text-white sm:text-xl">One place for the questions that move your day forward.</p>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="why-askzero" className="border-y border-white/10 bg-white/[0.025] px-5 py-16 sm:px-8 md:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent-hover">Made for everyday questions</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Useful before you know the perfect prompt.</h2>
              <p className="mt-4 text-base leading-relaxed text-white/65">You do not need to be technical. Start with what is on your mind and keep the conversation going until the answer is useful.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <UseCase icon={BookOpen} title="Learn with a clearer explanation" body="Break down difficult topics, prepare for an exam, or turn notes into a study plan." />
              <UseCase icon={BriefcaseBusiness} title="Get work unstuck" body="Draft an email, shape an idea, summarize a document, or make a practical plan." />
              <UseCase icon={Sparkles} title="Create something from a rough idea" body="Write, research, generate images, or build a small app from a simple description." wide />
            </div>
          </div>
        </section>

        <SavingsCalculator />

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 md:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-[28px] border border-white/12 bg-white/[0.035] p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent-hover"><ShieldCheck className="h-5 w-5" /></div>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.035em]">Your answers, with extra proof when it matters.</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65">AskZero keeps a receipt for each response, so you can check what was generated and what it cost. The technology stays in the background until you need it.</p>
            </div>
            <Link href="/signup" className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-md font-semibold text-ink transition-colors hover:bg-white/90">Get started <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-7 text-center text-sm text-white/40">AskZero. AI for everyday work, learning, and ideas.</footer>
    </div>
  );
}

function UseCase({ icon: Icon, title, body, wide = false }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; wide?: boolean }) {
  return (
    <article className={`rounded-2xl border border-white/10 bg-white/[0.035] p-6 ${wide ? "md:col-span-2" : ""}`}>
      <Icon className="h-5 w-5 text-accent-hover" />
      <h3 className="mt-7 font-display text-xl font-bold tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-white/60">{body}</p>
    </article>
  );
}
