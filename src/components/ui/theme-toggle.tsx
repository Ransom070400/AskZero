"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "./button";

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const cycle = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-8 w-8" />;
  }

  const current = (theme || "system") as keyof typeof icons;
  const Icon = icons[current];
  const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-text-secondary hover:text-foreground"
      onClick={() => setTheme(cycle[nextIdx])}
      title={`Theme: ${current}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
