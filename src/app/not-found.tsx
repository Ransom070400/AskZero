import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px] space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={36} />
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
              Page not found
            </h1>
            <p className="text-[14px] leading-relaxed text-text-secondary">
              That link doesn&apos;t go anywhere.
            </p>
          </div>
        </div>
        <Link href="/chat">
          <Button size="lg">Back to chat</Button>
        </Link>
      </div>
    </div>
  );
}
