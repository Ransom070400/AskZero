"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView, useMotionValueEvent, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./reduced-motion";

const MerkleScene = dynamic(() => import("./merkle-scene"), { ssr: false });

// Thresholds match the build windows in merkle-scene.
const STEPS = [
  {
    at: 0,
    title: "Every answer is hashed",
    body: "When an answer finishes, we fingerprint it: question, answer, model and cost go into one hash. Change a single character and the hash changes completely.",
  },
  {
    at: 0.24,
    title: "Hashes pair up, level by level",
    body: "Each hour's receipts are paired and hashed again, and again, until the whole batch collapses into a single Merkle root.",
  },
  {
    at: 0.62,
    title: "One root is anchored on 0G",
    body: "That root is written to our receipt contract on the 0G chain. Once it's in a block, nobody — including us — can quietly change any answer under it.",
  },
  {
    at: 0.8,
    title: "Any answer proves itself",
    body: "To verify one answer you only need its sibling hashes up the tree: 3 here, about 7 for a batch of 128. Recompute the root, compare it to the chain, done.",
  },
];

export function MerkleSection() {
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { margin: "100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  const hovered = useRef<number | null>(null);
  const [hoverOn, setHoverOn] = useState(false);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    let s = 0;
    STEPS.forEach((st, i) => {
      if (p >= st.at) s = i;
    });
    setStep(s);
  });

  const onHover = (i: number | null) => {
    hovered.current = i;
    setHoverOn(i !== null);
    document.body.style.cursor = i !== null ? "pointer" : "";
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative h-[320vh] border-t border-white/10 bg-ink text-white"
    >
      <div
        ref={stage}
        className="sticky top-0 mx-auto grid h-[100dvh] max-w-6xl grid-rows-[auto_1fr] items-center gap-2 px-6 py-10 md:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-1 lg:gap-10"
      >
        <div className="relative z-10">
          <p className="text-xs font-medium text-white/45">how the proof works</p>

          {/* Desktop: all steps listed, the active one lit. Mobile: just the
              active step, so the tree keeps most of the screen. */}
          <ol className="mt-5 hidden space-y-6 lg:block">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className={cn(
                  "border-l-2 pl-5 transition-[opacity,border-color] duration-slow ease-out",
                  i === step ? "border-accent-hover opacity-100" : "border-white/10 opacity-35"
                )}
              >
                <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-1.5 max-w-sm text-md leading-relaxed text-white/60">{s.body}</p>
              </li>
            ))}
          </ol>

          <div key={step} className="mt-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 lg:hidden">
            <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">
              <span className="mr-2 text-accent-hover tabular-nums">{step + 1}.</span>
              {STEPS[step].title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">{STEPS[step].body}</p>
          </div>
        </div>

        <div className="relative h-full min-h-[320px] w-full">
          {inView || step > 0 ? (
            <MerkleScene
              progress={scrollYProgress}
              active={inView}
              reduced={reduced}
              hovered={hovered}
              onHover={onHover}
            />
          ) : null}
          <p
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-2 text-center text-2xs text-white/35 transition-opacity duration-base",
              step === STEPS.length - 1 ? "opacity-100" : "opacity-0"
            )}
          >
            {hoverOn ? (
              <>
                <span className="text-accent-hover">purple</span> is the path ·{" "}
                <span className="text-success">green</span> are the hashes you need
              </>
            ) : (
              "tap or hover an answer at the bottom to see its proof · illustration"
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
