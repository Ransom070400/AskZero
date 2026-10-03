"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { easeOutCubic, fakeHash, makeCanvasTexture, readFonts, span, type Fonts } from "./canvas-kit";

// How a batch of answers becomes one on-chain root, driven by scroll:
// leaves (answer hashes) appear, pair up level by level into a Merkle root,
// the root drops into a 0G block, and finally one answer's proof path lights
// up — the handful of sibling hashes that's all you need to verify it.

const LEVELS = [8, 4, 2, 1];
const LEVEL_Y = [-1.75, -0.7, 0.35, 1.4];
const BLOCK_Y = 2.55;
const SPACING = 0.62;
const DEFAULT_LEAF = 5;

const COLOR = {
  built: new THREE.Color("#2B2535"),
  path: new THREE.Color("#9A5BD8"),
  sibling: new THREE.Color("#2E8B5E"),
  edge: new THREE.Color("#4A4255"),
  block: new THREE.Color("#1E1A26"),
};

// Each level's build window on the 0..1 scroll progress.
const APPEAR: [number, number, number][] = [
  // [start, stagger per node, duration]
  [0.02, 0.025, 0.06],
  [0.26, 0.035, 0.06],
  [0.44, 0.045, 0.06],
  [0.56, 0, 0.06],
];
const BLOCK_WINDOW: [number, number] = [0.64, 0.76];
const PROOF_START = 0.8;

const nodeX = (level: number, i: number) => {
  const n = LEVELS[level];
  const stride = SPACING * (LEVELS[0] / n);
  return (i - (n - 1) / 2) * stride;
};

const appearAt = (level: number, i: number) => {
  const [start, stagger, dur] = APPEAR[level];
  return [start + i * stagger, start + i * stagger + dur] as const;
};

type Role = "built" | "path" | "sibling";

/** Which role a node plays in the proof of `leaf` (null = no proof shown). */
function roleOf(level: number, i: number, leaf: number | null): Role {
  if (leaf === null) return "built";
  const onPath = leaf >> level;
  if (i === onPath) return "path";
  if (level < LEVELS.length - 1 && i === (onPath ^ 1)) return "sibling";
  return "built";
}

interface Shared {
  progress: React.MutableRefObject<number>;
  focus: React.MutableRefObject<number | null>;
}

function labelTexture(fonts: Fonts, lines: string[], width = 256, height = 128) {
  const { ctx, texture } = makeCanvasTexture(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#F4F0F8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (lines.length === 1) {
    ctx.font = `500 52px ${fonts.mono}`;
    ctx.fillText(lines[0], width / 2, height / 2 + 2);
  } else {
    ctx.font = `700 44px ${fonts.display}`;
    ctx.fillText(lines[0], width / 2, height * 0.34);
    ctx.font = `400 34px ${fonts.mono}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(lines[1], width / 2, height * 0.72);
  }
  texture.needsUpdate = true;
  return texture;
}

function TreeNode({
  level,
  index,
  size,
  label,
  fontsVersion,
  shared,
  onHover,
}: {
  level: number;
  index: number;
  size: [number, number, number];
  label: string;
  fontsVersion: number;
  shared: Shared;
  onHover?: (i: number | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const [from, to] = appearAt(level, index);
  const texture = useMemo(
    () => labelTexture(readFonts(), [label]),
    // fontsVersion re-paints once webfonts have loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, fontsVersion]
  );
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const p = shared.progress.current;
    const s = easeOutCubic(span(p, from, to));
    if (group.current) {
      group.current.scale.setScalar(Math.max(0.0001, s));
      group.current.visible = s > 0.001;
    }
    if (mat.current) {
      const role = roleOf(level, index, shared.focus.current);
      const target = role === "path" ? COLOR.path : role === "sibling" ? COLOR.sibling : COLOR.built;
      mat.current.color.lerp(target, 0.14);
      mat.current.emissive.lerp(role === "built" ? COLOR.built : target, 0.14);
      mat.current.emissiveIntensity = role === "built" ? 0.05 : 0.45;
    }
  });

  return (
    <group ref={group} position={[nodeX(level, index), LEVEL_Y[level], 0]}>
      <RoundedBox
        args={size}
        radius={0.05}
        smoothness={3}
        onPointerOver={onHover ? (e) => (e.stopPropagation(), onHover(index)) : undefined}
        onPointerOut={onHover ? () => onHover(null) : undefined}
      >
        <meshStandardMaterial ref={mat} color={COLOR.built} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0, size[2] / 2 + 0.002]}>
        <planeGeometry args={[size[0] * 0.86, size[0] * 0.43]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Edge({ level, child, shared }: { level: number; child: number; shared: Shared }) {
  // Edge from node `child` on `level` up to its parent on `level + 1`.
  const ref = useRef<Line2>(null);
  const parent = child >> 1;
  const [, childDone] = appearAt(level, child);
  const [parentFrom] = appearAt(level + 1, parent);
  const points = useMemo(
    () =>
      [
        [nodeX(level, child), LEVEL_Y[level] + 0.17, -0.02],
        [nodeX(level + 1, parent), LEVEL_Y[level + 1] - 0.18, -0.02],
      ] as [number, number, number][],
    [level, child, parent]
  );

  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const p = shared.progress.current;
    // Edges draw in just before their parent pops, so hashes visibly "flow up".
    const visible = span(p, Math.max(childDone, parentFrom - 0.04), parentFrom + 0.02);
    const focus = shared.focus.current;
    const onPath = focus !== null && child === focus >> level;
    const m = line.material;
    m.opacity = visible * (onPath ? 1 : 0.7);
    m.color.lerp(onPath ? COLOR.path : COLOR.edge, 0.14);
    m.linewidth = onPath ? 3 : 1.5;
  });

  return <Line ref={ref} points={points} color={COLOR.edge} lineWidth={1.5} transparent opacity={0} />;
}

function Block({ shared, fontsVersion }: { shared: Shared; fontsVersion: number }) {
  const group = useRef<THREE.Group>(null);
  const link = useRef<Line2>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useMemo(
    () => labelTexture(readFonts(), ["0G block", "#18,402,113"], 512, 160),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fontsVersion]
  );
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const p = shared.progress.current;
    const drop = easeOutCubic(span(p, ...BLOCK_WINDOW));
    if (group.current) {
      group.current.position.y = BLOCK_Y + (1 - drop) * 1.6;
      group.current.visible = drop > 0.001;
      group.current.scale.setScalar(0.85 + 0.15 * drop);
    }
    if (link.current) link.current.material.opacity = span(p, 0.72, 0.78);
    // The block lights up the moment the root is "anchored".
    if (glow.current) glow.current.emissiveIntensity = 0.5 * span(p, 0.74, 0.8);
  });

  return (
    <>
      <Line
        ref={link}
        points={[
          [0, LEVEL_Y[3] + 0.2, -0.02],
          [0, BLOCK_Y - 0.26, -0.02],
        ]}
        color={COLOR.path}
        lineWidth={3}
        dashed
        dashSize={0.06}
        gapSize={0.05}
        transparent
        opacity={0}
      />
      <group ref={group} position={[0, BLOCK_Y + 1.6, 0]}>
        <RoundedBox args={[1.6, 0.5, 0.3]} radius={0.06} smoothness={3}>
          <meshStandardMaterial
            ref={glow}
            color={COLOR.block}
            emissive={COLOR.path}
            emissiveIntensity={0}
            roughness={0.4}
            metalness={0.2}
          />
        </RoundedBox>
        <mesh position={[0, 0, 0.152]}>
          <planeGeometry args={[1.42, 0.44]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function Tree({
  progress,
  hovered,
  reduced,
  onHover,
}: {
  progress: MotionValue<number>;
  hovered: React.MutableRefObject<number | null>;
  reduced: boolean;
  onHover: (i: number | null) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const shared: Shared = {
    progress: useRef(progress.get()),
    focus: useRef<number | null>(null),
  };
  const fontsVersion = useFontsVersion();

  const labels = useMemo(
    () => LEVELS.map((n, l) => Array.from({ length: n }, (_, i) => (l === 3 ? "root" : fakeHash(`askzero-node-${l}-${i}`, 24).slice(-4)))),
    []
  );

  useFrame(({ clock }, delta) => {
    const target = progress.get();
    const p = shared.progress;
    // Ease toward the scroll position so fast flicks still animate smoothly.
    p.current = reduced ? target : THREE.MathUtils.damp(p.current, target, 6, delta);

    const treeBuilt = p.current >= APPEAR[3][0] + APPEAR[3][2];
    shared.focus.current =
      treeBuilt && hovered.current !== null
        ? hovered.current
        : p.current >= PROOF_START
          ? DEFAULT_LEAF
          : null;

    if (root.current && !reduced) {
      root.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.12;
    }
  });

  return (
    <group ref={root}>
      {LEVELS.slice(0, -1).map((n, l) =>
        Array.from({ length: n }, (_, i) => <Edge key={`e${l}-${i}`} level={l} child={i} shared={shared} />)
      )}
      {LEVELS.map((n, l) =>
        Array.from({ length: n }, (_, i) => (
          <TreeNode
            key={`n${l}-${i}`}
            level={l}
            index={i}
            size={l === 0 ? [0.5, 0.32, 0.12] : l === 3 ? [0.82, 0.4, 0.14] : [0.6, 0.34, 0.12]}
            label={labels[l][i]}
            fontsVersion={fontsVersion}
            shared={shared}
            onHover={l === 0 ? onHover : undefined}
          />
        ))
      )}
      <Block shared={shared} fontsVersion={fontsVersion} />
    </group>
  );
}

// The tree's bounding box in world units (leaves to block, plus margin).
const CONTENT = { width: 5.2, height: 4.9, centerY: 0.45 };

/** Pull the camera back until the whole tree fits, whatever the canvas shape. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / size.height;
    const z = Math.max(CONTENT.height / 2 / tan, CONTENT.width / 2 / (tan * aspect));
    cam.position.set(0, CONTENT.centerY, z);
    cam.lookAt(0, CONTENT.centerY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** Bumps once webfonts finish loading, so canvas labels can re-paint. */
function useFontsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setV(1));
    return () => {
      alive = false;
    };
  }, [setV]);
  return v;
}

export default function MerkleScene({
  progress,
  active,
  reduced,
  hovered,
  onHover,
}: {
  progress: MotionValue<number>;
  active: boolean;
  reduced: boolean;
  hovered: React.MutableRefObject<number | null>;
  onHover: (i: number | null) => void;
}) {
  return (
    <Canvas
      aria-hidden
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 8.6], fov: 35 }}
      flat
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onHover(null)}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 4, 6]} intensity={1.4} />
      <pointLight position={[0, 3, 2]} intensity={6} color="#B173E8" />
      <FitCamera />
      <Tree progress={progress} hovered={hovered} reduced={reduced} onHover={onHover} />
    </Canvas>
  );
}
