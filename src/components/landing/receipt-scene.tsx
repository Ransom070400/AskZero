"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import {
  easeInOutCubic,
  easeOutCubic,
  fakeHash,
  makeCanvasTexture,
  readFonts,
  short,
  span,
  wrap,
  type Fonts,
} from "./canvas-kit";

// The hero receipt: an answer prints onto a paper slip, a seal stamps onto it,
// and it flips to show the proof on the back. One loop tells the whole story
// — answer, price, proof — without a word of copy.

const W = 1.35; // receipt size in world units (texture is 1:2)
const H = 2.7;
const BEND = 0.12; // how far the top and bottom curl away from the camera
const TEX_W = 600;
const TEX_H = 1200;
const LOOP = 14; // seconds

const PAPER = "#F6F3EE";
const INK = "#1B1820";
const MUTED = "#8A8490";
const ACCENT = "#984FD8";

const QUESTION = "Explain inflation like I'm 12.";
const ANSWER =
  "Inflation is when prices rise over time, so the same ₦1,000 buys less than it used to. It happens when money grows faster than the things there are to buy.";
const RECEIPT_HASH = fakeHash("askzero-receipt-hero");
const BATCH_ROOT = fakeHash("askzero-batch-root");

// Stamp position on the front, in texture pixels → world units.
const STAMP_PX = { x: 410, y: 960 };
const STAMP_POS = new THREE.Vector3(
  (STAMP_PX.x / TEX_W - 0.5) * W,
  (0.5 - STAMP_PX.y / TEX_H) * H,
  0
);

const curveZ = (y: number) => -BEND * Math.pow(y / (H / 2), 2);

/** A curved paper strip. `back` faces the other way with mirrored UVs. */
function paperGeometry(back: boolean) {
  const g = new THREE.PlaneGeometry(W, H, 1, 40);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, curveZ(pos.getY(i)));
  if (back) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
  }
  g.computeVertexNormals();
  return g;
}

function paperShape(ctx: CanvasRenderingContext2D) {
  const tooth = 24;
  const depth = 10;
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.beginPath();
  ctx.moveTo(0, depth);
  for (let x = 0; x < TEX_W; x += tooth) {
    ctx.lineTo(x + tooth / 2, 0);
    ctx.lineTo(x + tooth, depth);
  }
  ctx.lineTo(TEX_W, TEX_H - depth);
  for (let x = TEX_W; x > 0; x -= tooth) {
    ctx.lineTo(x - tooth / 2, TEX_H);
    ctx.lineTo(x - tooth, TEX_H - depth);
  }
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
}

function dashed(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = "#CFC9C2";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(48, y);
  ctx.lineTo(TEX_W - 48, y);
  ctx.stroke();
  ctx.restore();
}

function row(ctx: CanvasRenderingContext2D, fonts: Fonts, y: number, k: string, v: string, color = INK) {
  ctx.font = `400 24px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText(k, 48, y);
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.fillText(v, TEX_W - 48, y);
  ctx.textAlign = "left";
}

function drawFront(ctx: CanvasRenderingContext2D, fonts: Fonts, typed: number, sealed: boolean) {
  paperShape(ctx);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = INK;
  ctx.font = `800 46px ${fonts.display}`;
  ctx.fillText("askzero", 48, 84);
  ctx.font = `400 18px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("inference receipt", TEX_W - 48, 80);
  ctx.textAlign = "left";
  dashed(ctx, 112);

  ctx.font = `500 20px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("you asked", 48, 166);
  ctx.font = `700 34px ${fonts.sans}`;
  ctx.fillStyle = INK;
  let y = 212;
  for (const line of wrap(ctx, QUESTION, TEX_W - 96)) {
    ctx.fillText(line, 48, y);
    y += 44;
  }

  y += 22;
  ctx.font = `500 20px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("answer", 48, y);
  y += 44;
  ctx.font = `400 29px ${fonts.sans}`;
  ctx.fillStyle = INK;
  const visible = ANSWER.slice(0, typed);
  const lines = wrap(ctx, visible, TEX_W - 96);
  for (const line of lines) {
    ctx.fillText(line, 48, y);
    y += 42;
  }
  // Print-head caret while the answer is still coming in.
  if (typed < ANSWER.length) {
    const last = lines[lines.length - 1] ?? "";
    const x = 48 + ctx.measureText(last).width + 4;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x, y - 42 - 24, 14, 30);
  }

  const done = typed >= ANSWER.length;
  dashed(ctx, 690);
  ctx.globalAlpha = done ? 1 : 0.25;
  row(ctx, fonts, 740, "model", "GLM 5.1");
  row(ctx, fonts, 780, "tokens", "412 in · 168 out");
  row(ctx, fonts, 820, "cost", "₦4.90", ACCENT);
  ctx.globalAlpha = 1;
  dashed(ctx, 860);

  ctx.font = `500 24px ${fonts.mono}`;
  ctx.fillStyle = sealed ? ACCENT : MUTED;
  ctx.fillText(sealed ? "sealed" : done ? "sealing…" : "printing…", 48, 920);
  if (sealed) {
    ctx.fillStyle = INK;
    ctx.font = `400 24px ${fonts.mono}`;
    ctx.fillText(short(RECEIPT_HASH), 48, 958);
  }

  ctx.font = `400 15px ${fonts.mono}`;
  ctx.fillStyle = "#B4AEB6";
  ctx.fillText("example receipt", 48, TEX_H - 48);
}

function drawBack(ctx: CanvasRenderingContext2D, fonts: Fonts) {
  paperShape(ctx);
  ctx.fillStyle = INK;
  ctx.font = `800 40px ${fonts.display}`;
  ctx.fillText("proof", 48, 82);
  ctx.font = `400 18px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("anchored on 0G", TEX_W - 48, 80);
  ctx.textAlign = "left";
  dashed(ctx, 112);

  ctx.font = `500 18px ${fonts.mono}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("receipt hash", 48, 160);
  ctx.font = `400 22px ${fonts.mono}`;
  ctx.fillStyle = INK;
  for (let i = 0; i < 4; i++) {
    ctx.fillText(RECEIPT_HASH.slice(i * 16, i * 16 + 16).replace(/(.{4})/g, "$1 ").trim(), 48, 200 + i * 32);
  }

  dashed(ctx, 350);
  row(ctx, fonts, 400, "batch root", short(BATCH_ROOT));
  row(ctx, fonts, 440, "position", "leaf 37 of 128");
  row(ctx, fonts, 480, "proof", "7 hashes");
  row(ctx, fonts, 520, "chain", "0G mainnet");
  row(ctx, fonts, 560, "status", "anchored ✓", ACCENT);
  dashed(ctx, 600);

  // A tiny Merkle tree with this receipt's path highlighted.
  const levels = [8, 4, 2, 1];
  const path = [5, 2, 1, 0];
  const top = 670;
  const gap = 120;
  levels.forEach((n, li) => {
    const y = top + (levels.length - 1 - li) * gap;
    for (let i = 0; i < n; i++) {
      const x = 48 + ((i + 0.5) * (TEX_W - 96)) / n;
      if (li > 0) {
        const cy = y + gap;
        for (const c of [i * 2, i * 2 + 1]) {
          const cx = 48 + ((c + 0.5) * (TEX_W - 96)) / levels[li - 1];
          const onPath = path[li - 1] === c && path[li] === i;
          ctx.strokeStyle = onPath ? ACCENT : "#D8D2CB";
          ctx.lineWidth = onPath ? 4 : 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(x, y, path[li] === i ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = path[li] === i ? ACCENT : "#CFC9C2";
      ctx.fill();
    }
  });

  ctx.font = `400 15px ${fonts.mono}`;
  ctx.fillStyle = "#B4AEB6";
  ctx.fillText("change one character and this path breaks", 48, TEX_H - 48);
}

function drawStamp(ctx: CanvasRenderingContext2D, fonts: Fonts) {
  const s = 256;
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-0.18);
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = ACCENT;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 46px ${fonts.display}`;
  ctx.fillText("SEALED", 0, -6);
  ctx.font = `500 22px ${fonts.mono}`;
  ctx.fillText("on 0G", 0, 36);
  ctx.restore();
}

function Receipt({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const flip = useRef<THREE.Group>(null);
  const stamp = useRef<THREE.Mesh>(null);
  const drawn = useRef({ typed: -1, sealed: false });
  const invalidate = useThree((s) => s.invalidate);

  const { front, back, stampTex, frontGeo, backGeo, fonts } = useMemo(() => {
    const front = makeCanvasTexture(TEX_W, TEX_H);
    const back = makeCanvasTexture(TEX_W, TEX_H);
    const stampTex = makeCanvasTexture(256, 256);
    return {
      front,
      back,
      stampTex,
      frontGeo: paperGeometry(false),
      backGeo: paperGeometry(true),
      fonts: readFonts(),
    };
  }, []);

  // Paint once fonts are ready (canvas text silently falls back otherwise).
  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      drawBack(back.ctx, fonts);
      back.texture.needsUpdate = true;
      drawStamp(stampTex.ctx, fonts);
      stampTex.texture.needsUpdate = true;
      drawn.current.typed = -1; // force the front to repaint
      invalidate(); // matters in reduced-motion "demand" mode
    };
    paint();
    document.fonts?.ready.then(paint);
    return () => {
      cancelled = true;
    };
  }, [back, stampTex, fonts, invalidate]);

  useEffect(
    () => () => {
      [front, back, stampTex].forEach((t) => t.texture.dispose());
      frontGeo.dispose();
      backGeo.dispose();
    },
    [front, back, stampTex, frontGeo, backGeo]
  );

  useFrame(({ clock }) => {
    // Reduced motion: hold the finished, sealed front.
    const t = reduced ? 7 : clock.getElapsedTime() % LOOP;

    const typed = Math.floor(span(t, 0.9, 5.2) * ANSWER.length);
    const sealed = t >= 6.0;
    if (typed !== drawn.current.typed || sealed !== drawn.current.sealed) {
      drawFront(front.ctx, fonts, typed, sealed);
      front.texture.needsUpdate = true;
      drawn.current = { typed, sealed };
    }

    if (group.current) {
      const enter = easeOutCubic(span(t, 0, 0.9));
      const exit = easeInOutCubic(span(t, 13.3, LOOP));
      group.current.position.y = -0.5 * (1 - enter) - 0.4 * exit;
      group.current.scale.setScalar(0.92 + 0.08 * enter - 0.06 * exit);
      // The stamp lands with a small physical jolt.
      const jolt = span(t, 6.0, 6.5);
      const kick = jolt > 0 && jolt < 1 ? Math.sin(jolt * Math.PI * 3) * (1 - jolt) * 0.06 : 0;
      group.current.rotation.x = -0.08 + kick;
      // Idle sway so it never sits dead still.
      group.current.rotation.z = reduced ? 0 : Math.sin(t * 0.6) * 0.025;
    }

    if (flip.current) {
      const toBack = easeInOutCubic(span(t, 7.4, 8.3));
      const toFront = easeInOutCubic(span(t, 11.0, 11.9));
      flip.current.rotation.y = Math.PI * (toBack - toFront) + (reduced ? 0 : Math.sin(t * 0.5) * 0.1);
    }

    if (stamp.current) {
      const drop = span(t, 5.4, 6.0);
      const land = easeOutCubic(drop);
      const overshoot = span(t, 6.0, 6.35);
      const squash = overshoot > 0 && overshoot < 1 ? Math.sin(overshoot * Math.PI) * 0.12 : 0;
      stamp.current.visible = t >= 5.4;
      stamp.current.position.z = curveZ(STAMP_POS.y) + 0.012 + (1 - land) * 1.6;
      stamp.current.scale.setScalar(1 + (1 - land) * 0.6 + squash);
      const mat = stamp.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.min(1, drop * 2) * 0.92;
    }
  });

  return (
    <group ref={group}>
      <group ref={flip}>
        <mesh geometry={frontGeo}>
          <meshStandardMaterial map={front.texture} roughness={0.85} metalness={0} alphaTest={0.5} />
        </mesh>
        <mesh geometry={backGeo}>
          <meshStandardMaterial map={back.texture} roughness={0.85} metalness={0} alphaTest={0.5} />
        </mesh>
        <mesh ref={stamp} position={[STAMP_POS.x, STAMP_POS.y, 0]} visible={false}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshStandardMaterial
            map={stampTex.texture}
            transparent
            depthWrite={false}
            roughness={0.6}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function ReceiptScene({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <Canvas
      aria-hidden
      frameloop={active ? "always" : reduced ? "demand" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.7], fov: 35 }}
      flat
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={1.55} />
      <directionalLight position={[3, 4, 5]} intensity={0.9} />
      {/* Accent rim light from behind-left, so the paper edge catches colour */}
      <pointLight position={[-2.5, 1.5, -1.5]} intensity={8} color="#B173E8" />
      <PresentationControls
        global={false}
        cursor
        snap
        speed={1.4}
        polar={[-0.25, 0.25]}
        azimuth={[-0.7, 0.7]}
      >
        <Receipt reduced={reduced} />
      </PresentationControls>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.45} scale={5} blur={2.6} far={2.5} color="#000000" />
    </Canvas>
  );
}
