import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import "katex/dist/katex.min.css";

// Self-hosted (latin variable subsets from Google Fonts, all OFL) rather than
// next/font/google: that fetches from Google at build time, and an uncached
// build failed when Google answered with a font URL Next couldn't parse.
const sans = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
});

const display = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-display",
  weight: "500 800",
  display: "swap",
});

// Hashes, tx ids, amounts — the "proof" surfaces read as machine output.
const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-mono",
  weight: "400 500",
  display: "swap",
  // The default metric-matched fallback is Arial, which isn't monospace.
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: pinch-zoom stays available for accessibility. The
  // iOS focus-zoom is prevented by keeping input font-size >= 16px instead.
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: "askzero — decentralized AI for everyone",
  description:
    "Chat with AI powered by 0G decentralized compute. Pay with Naira, USD, or 0G tokens. No subscriptions.",
  openGraph: {
    title: "askzero — decentralized AI for everyone",
    description:
      "Chat with AI powered by 0G decentralized compute. Pay with Naira, USD, or 0G tokens.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "askzero — decentralized AI for everyone",
    description:
      "Chat with AI powered by 0G decentralized compute. Pay with Naira, USD, or 0G tokens.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          sans.variable,
          display.variable,
          mono.variable
        )}
      >
        <ViewTransitions>
          <ThemeProvider>{children}</ThemeProvider>
        </ViewTransitions>
        <Toaster />
      </body>
    </html>
  );
}
