"use client";

import Image from "next/image";
import { useRef } from "react";
import { Sparkles } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Zero turns a question into a clear answer, entirely through transforms and opacity. */
export function ZeroGuide() {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const character = useRef<HTMLDivElement>(null);
  const orbit = useRef<HTMLDivElement>(null);
  const question = useRef<HTMLDivElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const leftSpark = useRef<HTMLSpanElement>(null);
  const rightSpark = useRef<HTMLSpanElement>(null);
  const quickX = useRef<((value: number) => void) | null>(null);
  const quickY = useRef<((value: number) => void) | null>(null);

  useGSAP(
    () => {
      if (!stage.current || !character.current || !tilt.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      quickX.current = gsap.quickTo(tilt.current, "x", { duration: 0.65, ease: "power3.out" });
      quickY.current = gsap.quickTo(tilt.current, "y", { duration: 0.65, ease: "power3.out" });

      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo(character.current, { autoAlpha: 0, y: 46, scale: 0.86 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.1 })
        .fromTo(orbit.current, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 0.75, scale: 1, duration: 0.9 }, "-=0.7")
        .fromTo([leftSpark.current, rightSpark.current], { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.45, stagger: 0.12 }, "-=0.35");

      gsap.to(character.current, { y: -13, rotation: 1.4, duration: 3.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(orbit.current, { rotation: 360, duration: 18, repeat: -1, ease: "none" });
      gsap.to(leftSpark.current, { y: -14, duration: 2.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(rightSpark.current, { y: 12, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });

      gsap.timeline({ repeat: -1, repeatDelay: 1.9, delay: 1.4 })
        .set(question.current, { autoAlpha: 0, scale: 0.6, x: -32, y: 18 })
        .set(answer.current, { autoAlpha: 0, scale: 0.3, x: 20, y: -2 })
        .to(question.current, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.45, ease: "back.out(2)" })
        .to(question.current, { x: 42, y: -22, scale: 0.48, autoAlpha: 0, duration: 0.85, ease: "power2.in" }, "+=0.7")
        .to(answer.current, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.52, ease: "back.out(2)" }, "-=0.2")
        .to(answer.current, { scale: 1.22, duration: 0.32, yoyo: true, repeat: 1, ease: "sine.inOut" }, "+=0.15")
        .to(answer.current, { autoAlpha: 0, scale: 0.45, y: -24, duration: 0.5, ease: "power2.in" }, "+=0.8");
    },
    { scope: stage }
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    quickX.current?.(((event.clientX - rect.left) / rect.width - 0.5) * 12);
    quickY.current?.(((event.clientY - rect.top) / rect.height - 0.5) * 8);
  };

  return (
    <div ref={stage} onPointerMove={handlePointerMove} onPointerLeave={() => { quickX.current?.(0); quickY.current?.(0); }} className="relative mx-auto flex aspect-square w-full max-w-[580px] items-center justify-center overflow-visible" aria-hidden>
      <div className="absolute inset-[11%] rounded-full bg-accent/25 blur-[88px]" />
      <div ref={orbit} className="absolute inset-[17%] rounded-full border border-accent-hover/20" />
      <div className="absolute inset-[27%] rounded-full border border-white/10" />
      <span ref={leftSpark} className="absolute left-[8%] top-[29%] h-3 w-3 rounded-full bg-accent-hover shadow-[0_0_24px_hsl(var(--accent-hover)/0.8)]" />
      <span ref={rightSpark} className="absolute bottom-[21%] right-[8%] h-2.5 w-2.5 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.5)]" />
      <div ref={question} className="absolute left-[16%] top-[40%] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-ink/80 text-xl font-bold text-white shadow-[0_12px_32px_rgba(0,0,0,0.28)]">?</div>
      <div ref={answer} className="absolute right-[15%] top-[31%] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-accent-hover/40 bg-accent/20 text-accent-hover shadow-[0_12px_32px_hsl(var(--accent)/0.25)]"><Sparkles className="h-5 w-5" strokeWidth={1.8} /></div>
      <div ref={tilt} className="relative z-10 w-full will-change-transform">
        <div ref={character} className="will-change-transform">
          <Image src="/images/zero-guide-character.png" alt="" width={1536} height={2048} priority sizes="(max-width: 1024px) 88vw, 46vw" className="h-auto w-full object-contain mix-blend-screen" />
        </div>
      </div>
    </div>
  );
}
