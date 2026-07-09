import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from "next/font/google";
import { cn } from "@/lib/utils";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import "katex/dist/katex.min.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
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
          display.variable
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
