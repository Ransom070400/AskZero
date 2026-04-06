"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Cinematic canvas — valley with wave dunes + rain lines
function CinematicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let dpr: number;

    // Rain lines
    const lines: { x: number; y: number; speed: number; len: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      lines.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.002 + Math.random() * 0.004,
        len: 0.02 + Math.random() * 0.06,
        opacity: 0.03 + Math.random() * 0.08,
      });
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };

    const noise = (x: number, y: number, t: number) =>
      Math.sin(x * 1.5 + t) * Math.cos(y * 0.8 + t * 0.7) * 0.5 +
      Math.sin(x * 0.7 - t * 0.5 + y * 1.2) * 0.3 +
      Math.sin((x + y) * 0.4 + t * 0.3) * 0.2;

    const render = (time: number) => {
      const t = time * 0.0004;
      const w = canvas.offsetWidth;
      const cw = canvas.width;
      const ch = canvas.height;

      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, cw, ch);

      // Center spotlight glow
      const grd = ctx.createRadialGradient(
        cw * 0.5, ch * 0.45, 0,
        cw * 0.5, ch * 0.45, cw * 0.4
      );
      grd.addColorStop(0, "rgba(100, 140, 255, 0.06)");
      grd.addColorStop(0.3, "rgba(80, 100, 200, 0.03)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);

      // Draw wave dunes — left and right sides forming valley
      const drawDune = (side: "left" | "right") => {
        const rows = 40;
        const cols = 30;

        for (let r = 0; r < rows; r++) {
          const rowProgress = r / rows; // 0 = near, 1 = far
          const perspective = 1 - rowProgress * 0.7; // shrinks toward horizon
          const yBase = (0.35 + rowProgress * 0.55) * ch;

          ctx.beginPath();
          for (let c = 0; c <= cols; c++) {
            const colProgress = c / cols;
            let x: number;

            if (side === "left") {
              x = colProgress * w * 0.42 * perspective * dpr;
            } else {
              x = (w - colProgress * w * 0.42 * perspective) * dpr;
            }

            const heightVal = noise(
              colProgress * 3 + (side === "left" ? 0 : 5),
              rowProgress * 4,
              t
            );
            const y = yBase - heightVal * 25 * perspective * dpr;

            if (c === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          const opacity = (0.08 - rowProgress * 0.06) * perspective;
          ctx.strokeStyle = `rgba(120, 150, 255, ${Math.max(opacity, 0.01)})`;
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
        }
      };

      drawDune("left");
      drawDune("right");

      // Horizontal perspective lines (vanishing point)
      const vanishX = cw * 0.5;
      const vanishY = ch * 0.35;
      for (let i = 0; i < 12; i++) {
        const y = vanishY + (ch - vanishY) * (i / 12) * (i / 12);
        const spread = (i / 12) * cw * 0.5;

        ctx.beginPath();
        ctx.moveTo(vanishX - spread, y);
        ctx.lineTo(vanishX + spread, y);
        ctx.strokeStyle = `rgba(120, 150, 255, ${0.015 + (i / 12) * 0.02})`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }

      // Rain lines falling from top
      for (const line of lines) {
        line.y += line.speed;
        if (line.y > 1 + line.len) {
          line.y = -line.len;
          line.x = Math.random();
        }

        const x = line.x * cw;
        const y1 = line.y * ch;
        const y2 = (line.y - line.len) * ch;

        const grad = ctx.createLinearGradient(x, y2, x, y1);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, `rgba(150, 180, 255, ${line.opacity})`);
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.moveTo(x, y2);
        ctx.lineTo(x, y1);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }

      // Subtle noise grain
      const imgData = ctx.getImageData(0, 0, cw, ch);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 32) {
        const grain = (Math.random() - 0.5) * 6;
        data[i] = Math.max(0, Math.min(255, data[i] + grain));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
      }
      ctx.putImageData(imgData, 0, 0);

      animId = requestAnimationFrame(render);
    };

    resize();
    animId = requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  );
}

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3 + delay * 0.12,
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
});

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: "#050507" }}>
      <CinematicCanvas />

      {/* Nav */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5"
      >
        <span className="text-sm font-semibold tracking-tight text-white/90">
          AskZero
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-white/40 hover:text-white/70 transition-colors duration-200"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/80 hover:bg-white/5 hover:border-white/20 transition-all duration-200"
          >
            Get started
          </Link>
        </div>
      </motion.header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-8">
          <motion.p
            {...fade(0)}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/30"
          >
            Powered by 0G Decentralized Compute
          </motion.p>

          <motion.h1
            {...fade(1)}
            className="text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.05" }}
          >
            The future of AI
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
              is decentralized.
            </span>
          </motion.h1>

          <motion.p
            {...fade(2)}
            className="mx-auto max-w-md text-base text-white/40 leading-relaxed md:text-lg"
          >
            Private, verifiable AI inference on a global compute network.
            Pay with Naira, USD, or 0G tokens.
          </motion.p>

          <motion.div {...fade(3)} className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all duration-300 hover:shadow-[0_0_40px_rgba(100,150,255,0.25)] active:scale-[0.97]"
            >
              Start chatting
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              {/* Glow halo */}
              <span className="absolute inset-0 -z-10 rounded-full bg-white/20 blur-xl" />
            </Link>
          </motion.div>
        </div>

        {/* Features row */}
        <motion.div
          {...fade(4)}
          className="mt-28 flex items-center gap-8 md:gap-16 text-white/25 text-xs uppercase tracking-[0.15em]"
        >
          <span>Streaming</span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span>Verifiable</span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span>Private</span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span>Affordable</span>
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="relative z-10 flex items-center justify-center py-8 text-[11px] uppercase tracking-[0.2em] text-white/15"
      >
        &copy; {new Date().getFullYear()} AskZero &middot; Built on 0G Network
      </motion.footer>
    </div>
  );
}
