"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The landing character gives the product a human, welcoming focal point.
 * Its slow lift signals that AskZero is ready to help, without competing with
 * the CTA or running a costly canvas animation.
 */
export function ZeroGuide() {
  const reduced = useReducedMotion();

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[560px] items-center justify-center" aria-hidden>
      <div className="absolute inset-[12%] rounded-full bg-accent/20 blur-[72px]" />
      <motion.span
        animate={reduced ? undefined : { y: [0, -11, 0], opacity: [0.35, 1, 0.35] }}
        transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[26%] z-20 h-3 w-3 rounded-full bg-accent-hover shadow-[0_0_24px_hsl(var(--accent-hover)/0.8)]"
      />
      <motion.span
        animate={reduced ? undefined : { y: [0, 9, 0], opacity: [1, 0.35, 1] }}
        transition={reduced ? undefined : { duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute bottom-[22%] left-[10%] z-20 h-2 w-2 rounded-full bg-white/75"
      />
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.92, y: 28 }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                scale: 1,
                y: [0, -14, 0],
                rotate: [0, -1.5, 0, 1, 0],
              }
        }
        transition={
          reduced
            ? { duration: 0.01 }
            : {
                opacity: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                scale: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                y: { duration: 5.4, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 7.2, repeat: Infinity, ease: "easeInOut" },
              }
        }
        className="relative z-10 w-full will-change-transform"
      >
        <Image
          src="/images/zero-guide-character.png"
          alt=""
          width={1536}
          height={2048}
          priority
          sizes="(max-width: 1024px) 88vw, 46vw"
          className="h-auto w-full object-contain mix-blend-screen"
        />
      </motion.div>
    </div>
  );
}
