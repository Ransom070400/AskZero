// AskZero color palettes. Same keys for light + dark so components can read
// them from useTheme() and restyle at runtime.

export interface Palette {
  bg: string;
  surface: string;
  elevated: string;
  card: string;
  border: string;
  borderSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentBright: string;
  onAccent: string;
  success: string;
  error: string;
  // chat bubbles
  userBubble: string;
  onUserBubble: string;
  aiBubble: string;
  aiText: string;
}

export const darkColors: Palette = {
  bg: "#000000",
  surface: "#0d0d0d",
  elevated: "#141414",
  card: "#161616",
  border: "#262626",
  borderSoft: "#1a1a1a",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.6)",
  textTertiary: "rgba(255,255,255,0.4)",
  accent: "#B75FFF",
  accentBright: "#CB8AFF",
  onAccent: "#000000",
  success: "#3ecf8e",
  error: "#ff5c5c",
  userBubble: "#ffffff",
  onUserBubble: "#000000",
  aiBubble: "#161616",
  aiText: "#ededed",
};

export const lightColors: Palette = {
  bg: "#ffffff",
  surface: "#f4f4f6",
  elevated: "#ffffff",
  card: "#f0f0f3",
  border: "#e3e3e8",
  borderSoft: "#ededf0",
  text: "#0a0a0a",
  textSecondary: "rgba(0,0,0,0.6)",
  textTertiary: "rgba(0,0,0,0.45)",
  accent: "#8B3FD6",
  accentBright: "#9F52E8",
  onAccent: "#ffffff",
  success: "#12a150",
  error: "#e5484d",
  userBubble: "#8B3FD6",
  onUserBubble: "#ffffff",
  aiBubble: "#f2f2f5",
  aiText: "#1a1a1a",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

// Back-compat: modules that still import `colors` directly get the dark palette.
// Prefer useTheme() for anything that should respond to the light/dark toggle.
export const colors = darkColors;
