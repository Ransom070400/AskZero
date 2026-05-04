import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      {/* Ambient brand backdrop — soft accent radial, never noisy */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--accent) / 0.18) 0%, transparent 60%)",
          }}
        />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 md:py-16">
        {children}
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-4 px-5 pb-8 text-[11px] font-medium tracking-wide text-text-tertiary">
        <Link href="/" className="hover:text-foreground transition-colors duration-fast">
          home
        </Link>
        <span className="h-1 w-1 rounded-full bg-text-tertiary/40" />
        <span>decentralized · private · TEE-attested</span>
      </footer>
    </div>
  );
}
