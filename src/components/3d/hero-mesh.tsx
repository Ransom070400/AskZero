"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createNoise3D } from "simplex-noise";
import * as THREE from "three";

const noise3D = createNoise3D();

function WirePlane({ isDark }: { isDark: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const visible = useRef(true);

  useEffect(() => {
    const handleVisibility = () => {
      visible.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const segments = 32;

  useFrame(({ clock }) => {
    if (!meshRef.current || !visible.current) return;

    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const time = reducedMotion ? 0 : clock.getElapsedTime() * 0.12;
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      const height =
        noise3D(x * 0.3, y * 0.3, time) * 0.4 +
        noise3D(x * 0.6, y * 0.6, time * 0.8) * 0.15 +
        noise3D(x * 0.15, y * 0.15, time * 1.2) * 0.3;

      positions.setZ(i, height);
    }

    positions.needsUpdate = true;
  });

  const lineColor = isDark ? "#8B7FFF" : "#6D5DF5";
  const lineOpacity = isDark ? 0.7 : 0.4;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2 + 0.26, 0, 0]}>
      <planeGeometry args={[12, 12, segments, segments]} />
      <meshBasicMaterial
        color={lineColor}
        wireframe
        transparent
        opacity={lineOpacity}
      />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Subtle parallax drift
    camera.position.x = Math.sin(t * 0.08) * 0.15;
    camera.position.y = 4.5 + Math.cos(t * 0.06) * 0.1;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Scene({ isDark }: { isDark: boolean }) {
  return (
    <>
      <CameraRig />
      <WirePlane isDark={isDark} />
    </>
  );
}

export function HeroMesh() {
  const [isDark, setIsDark] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Detect mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Mobile fallback — static gradient
  if (isMobile) {
    return (
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-20 dark:opacity-15"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at 50% 40%, #8B7FFF22, transparent 60%)"
              : "radial-gradient(ellipse at 50% 40%, #6D5DF510, transparent 50%)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 -z-10 h-[80vh]">
      <Canvas
        camera={{ position: [0, 4.5, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <Scene isDark={isDark} />
      </Canvas>

      {/* Radial vignette — fades mesh at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 50% 40%, transparent 45%, hsl(240 6% 4%) 80%)"
            : "radial-gradient(ellipse at 50% 40%, transparent 35%, hsl(40 20% 98%) 70%)",
        }}
      />

      {/* Bottom fade to solid background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: isDark
            ? "linear-gradient(transparent, hsl(240 6% 4%))"
            : "linear-gradient(transparent, hsl(40 20% 98%))",
        }}
      />
    </div>
  );
}
