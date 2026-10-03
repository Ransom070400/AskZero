"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView } from "framer-motion";
import { prefersReducedMotion } from "./reduced-motion";

// three.js loads after the hero text has painted — the headline and CTA never
// wait on WebGL.
const ReceiptScene = dynamic(() => import("./receipt-scene"), {
  ssr: false,
  loading: () => <ReceiptPlaceholder />,
});

function ReceiptPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center" aria-hidden>
      <div className="h-[78%] w-[39%] max-w-[260px] -rotate-3 rounded-sm bg-white/[0.04]" />
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ReceiptHero() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "100px" });
  const [ready, setReady] = useState<{ webgl: boolean; reduced: boolean } | null>(null);

  useEffect(() => {
    setReady({ webgl: hasWebGL(), reduced: prefersReducedMotion() });
  }, []);

  return (
    <div ref={ref} className="relative h-[420px] w-full sm:h-[500px] lg:h-[600px]">
      {ready === null || !ready.webgl ? (
        <ReceiptPlaceholder />
      ) : (
        <ReceiptScene active={inView && !ready.reduced} reduced={ready.reduced} />
      )}
    </div>
  );
}
