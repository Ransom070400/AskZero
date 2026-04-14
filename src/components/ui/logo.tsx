"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  variant?: "light" | "dark";
  animated?: boolean;
  className?: string;
}

export function Logo({
  size = 28,
  variant = "light",
  animated = false,
  className,
}: LogoProps) {
  const wordColor = variant === "dark" ? "#FEFEFE" : "#0A0A0A";
  const blackArc = variant === "dark" ? "#FEFEFE" : "#0A0A0A";
  const purpleArc = variant === "dark" ? "#CB8AFF" : "#B75FFF";

  const stroke = Math.max(6, Math.round(size * 0.32));
  const zeroSize = size;

  return (
    <span
      className={cn("inline-flex items-center", animated && "logo-animated", className)}
      style={{ gap: 0 }}
      aria-label="askzero"
    >
      <span
        className="logo-word logo-ask"
        style={{
          fontSize: size,
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: "-0.04em",
          color: wordColor,
        }}
      >
        ask
      </span>
      <span
        className="logo-zero"
        style={{
          width: zeroSize * 0.72,
          height: zeroSize,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={zeroSize * 0.72}
          height={zeroSize * 0.72}
          viewBox="-26 -26 52 52"
          style={{ overflow: "visible" }}
        >
          <path
            className="logo-zero-black"
            d="M 0,-22 A 22,22 0 1 1 15,-15"
            fill="none"
            stroke={blackArc}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            className="logo-zero-purple"
            d="M 15,-15 A 22,22 0 1 1 0,-22"
            fill="none"
            stroke={purpleArc}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className="logo-word logo-ero"
        style={{
          fontSize: size,
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: "-0.04em",
          color: wordColor,
          marginLeft: -2,
        }}
      >
        ero
      </span>
    </span>
  );
}
