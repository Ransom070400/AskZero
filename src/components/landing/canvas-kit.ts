import * as THREE from "three";

// Shared helpers for the landing-page 3D scenes. Text is painted onto 2D
// canvases and used as textures, so the scenes use the page's own fonts (via
// the next/font CSS variables) and nothing is fetched from a font CDN.

export interface Fonts {
  sans: string;
  display: string;
  mono: string;
}

export function readFonts(): Fonts {
  const css = getComputedStyle(document.body);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    sans: v("--font-sans", "system-ui, sans-serif"),
    display: v("--font-display", "system-ui, sans-serif"),
    mono: v("--font-mono", "ui-monospace, monospace"),
  };
}

/** A canvas + texture pair; call `texture.needsUpdate = true` after drawing. */
export function makeCanvasTexture(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx, texture };
}

/** Greedy word-wrap for canvas text. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Deterministic hex "hash" for illustration. The scenes are explainers, not
 * real receipts, so they don't need keccak — just stable, plausible digits.
 */
export function fakeHash(seed: string, length = 64) {
  let h = 2166136261;
  let out = "";
  while (out.length < length) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
    seed += out.length;
  }
  return out.slice(0, length);
}

export const short = (hex: string) => `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** 0→1 progress of `t` through the window [start, end], clamped. */
export const span = (t: number, start: number, end: number) =>
  Math.min(1, Math.max(0, (t - start) / (end - start)));

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
