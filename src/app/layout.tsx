import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: "AskZero — Decentralized AI for Everyone",
  description:
    "Chat with AI powered by 0G decentralized compute. Pay with Naira, USD, or 0G tokens. No subscriptions.",
  openGraph: {
    title: "AskZero — Decentralized AI for Everyone",
    description:
      "Chat with AI powered by 0G decentralized compute. Pay with Naira, USD, or 0G tokens.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AskZero — Decentralized AI for Everyone",
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
          geistSans.variable,
          geistMono.variable
        )}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
