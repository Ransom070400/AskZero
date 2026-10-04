"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./reduced-motion";

// The hero backdrop: rows of faint hex drift sideways like a ledger being
// written. Each time the receipt in the hero is sealed (receipt-scene fires
// SEAL_EVENT) one row is rewritten with a fresh hash and flares purple, so the
// background records every seal instead of just decorating.

export const SEAL_EVENT = "askzero:receipt-sealed";

const FONT_PX = 13;
const LINE_PX = 24;
const GROUP = 4; // hex chars per group, separated by a space
const BASE_ALPHA = 0.055;
const FPS = 30;
const ACCENT = [194, 145, 237]; // --accent-hover in dark mode

const hex = (n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[(Math.random() * 16) | 0];
  return s;
};
const groups = (count: number) => Array.from({ length: count }, () => hex(GROUP)).join(" ");

interface Row {
  text: string;
  speed: number; // px per second; sign = direction
  glow: number; // 0..1, decays after a seal
}

export function HashStream() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const mono =
      getComputedStyle(document.body).getPropertyValue("--font-mono").trim() || "ui-monospace, monospace";
    let rows: Row[] = [];
    let width = 0;
    let height = 0;
    let charW = 8;
    let cols = 0; // characters needed to cover one row twice (for wrapping)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `400 ${FONT_PX}px ${mono}`;
      ctx.textBaseline = "middle";
      charW = ctx.measureText("0").width || 8;
      const groupCount = Math.ceil(width / (charW * (GROUP + 1))) + 2;
      cols = groupCount * (GROUP + 1);
      const count = Math.ceil(height / LINE_PX) + 1;
      rows = Array.from({ length: count }, (_, i) => ({
        text: groups(groupCount),
        speed: (6 + Math.random() * 10) * (i % 2 ? 1 : -1),
        glow: rows[i]?.glow ?? 0,
      }));
    };

    let last = 0;
    let elapsed = 0;
    let raf = 0;
    let visible = true;
    let mutateAcc = 0;

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      const segment = cols * charW; // one full copy of a row's text
      rows.forEach((row, i) => {
        const y = i * LINE_PX + LINE_PX / 2;
        const offset = reduced ? 0 : (((elapsed * row.speed) % segment) + segment) % segment;
        if (row.glow > 0.01) {
          const [r, g, b] = ACCENT;
          ctx.fillStyle = `rgba(${r},${g},${b},${BASE_ALPHA + row.glow * 0.5})`;
          row.glow *= Math.exp(-dt / 0.9); // ~2.5s to fade out
        } else {
          row.glow = 0;
          ctx.fillStyle = `rgba(255,255,255,${BASE_ALPHA})`;
        }
        // Two copies side by side so the drift wraps seamlessly.
        ctx.fillText(row.text, -offset, y);
        ctx.fillText(row.text, segment - offset, y);
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      if (now - last < 1000 / FPS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // The ledger keeps writing: a few groups change every so often.
      mutateAcc += dt;
      if (mutateAcc > 0.12 && rows.length) {
        mutateAcc = 0;
        const row = rows[(Math.random() * rows.length) | 0];
        const g = (Math.random() * (row.text.length / (GROUP + 1))) | 0;
        const at = g * (GROUP + 1);
        row.text = row.text.slice(0, at) + hex(GROUP) + row.text.slice(at + GROUP);
      }
      draw(dt);
    };

    const onSeal = () => {
      if (!rows.length) return;
      // Pick a row around the middle of the hero, where the receipt sits.
      const mid = Math.floor(rows.length * (0.35 + Math.random() * 0.3));
      const row = rows[mid];
      row.text = groups(row.text.length / (GROUP + 1));
      row.glow = 1;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    // Draw once even if fonts arrive late, then animate (or hold still).
    document.fonts?.ready.then(() => {
      resize();
      draw(0);
    });
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(frame);
      window.addEventListener(SEAL_EVENT, onSeal);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener(SEAL_EVENT, onSeal);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={[
        "pointer-events-none absolute inset-0 h-full w-full",
        // Fade out under the copy: from the top on mobile, from the left on
        // desktop, so the hex only reads around the receipt.
        "[-webkit-mask-image:linear-gradient(to_bottom,transparent_25%,black_70%)] [mask-image:linear-gradient(to_bottom,transparent_25%,black_70%)]",
        "lg:[-webkit-mask-image:linear-gradient(to_right,transparent_32%,black_72%)] lg:[mask-image:linear-gradient(to_right,transparent_32%,black_72%)]",
      ].join(" ")}
    />
  );
}
