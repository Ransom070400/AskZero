"use client";

import { useEffect, useRef } from "react";

export function FloatingSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      hue: number;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const initParticles = () => {
      particles = [];
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const count = 120;

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.1,
          hue: 250 + Math.random() * 30,
        });
      }
    };

    const drawGlowOrb = (
      time: number,
      cx: number,
      cy: number,
      baseRadius: number,
      hue: number
    ) => {
      const pulse = Math.sin(time * 0.001) * 15;
      const radius = baseRadius + pulse;

      // Outer glow
      const grad3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
      grad3.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.08)`);
      grad3.addColorStop(0.5, `hsla(${hue}, 80%, 50%, 0.03)`);
      grad3.addColorStop(1, "transparent");
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Core glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.25)`);
      grad.addColorStop(0.4, `hsla(${hue}, 80%, 55%, 0.12)`);
      grad.addColorStop(0.7, `hsla(${hue + 20}, 70%, 50%, 0.05)`);
      grad.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Inner bright spot
      const grad2 = ctx.createRadialGradient(
        cx - radius * 0.2,
        cy - radius * 0.2,
        0,
        cx,
        cy,
        radius * 0.5
      );
      grad2.addColorStop(0, `hsla(${hue}, 100%, 85%, 0.3)`);
      grad2.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = grad2;
      ctx.fill();
    };

    const animate = (time: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      // Floating orbs
      const cx1 = w * 0.5 + Math.sin(time * 0.0005) * 30;
      const cy1 = h * 0.45 + Math.cos(time * 0.0007) * 20;
      drawGlowOrb(time, cx1, cy1, 100, 265);

      const cx2 = w * 0.38 + Math.cos(time * 0.0004) * 40;
      const cy2 = h * 0.55 + Math.sin(time * 0.0006) * 25;
      drawGlowOrb(time, cx2, cy2, 60, 230);

      const cx3 = w * 0.62 + Math.sin(time * 0.0003) * 35;
      const cy3 = h * 0.4 + Math.cos(time * 0.0005) * 30;
      drawGlowOrb(time, cx3, cy3, 45, 290);

      // Particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(260, 60%, 60%, ${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animationId = requestAnimationFrame(animate);

    window.addEventListener("resize", () => {
      resize();
      initParticles();
    });

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10 h-full w-full"
      style={{ background: "transparent" }}
    />
  );
}
