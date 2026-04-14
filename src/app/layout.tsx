import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
          inter.variable
        )}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
