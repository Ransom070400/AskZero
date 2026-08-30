"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

// Route-level error boundary. Without it a thrown render error falls through to
// Next's stock error screen, which looks nothing like the app and offers no way
// back — a jarring end to a session. `reset()` re-renders the segment, which is
// usually enough to recover from a transient fetch failure.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px] space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={36} />
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
              Something went wrong
            </h1>
            <p className="text-[14px] leading-relaxed text-text-secondary">
              That page didn&apos;t load. Your chats and balance are untouched.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset} size="lg">
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
          <Link href="/chat">
            <Button variant="ghost" size="lg">
              Back to chat
            </Button>
          </Link>
        </div>

        {/* The digest is the only handle on a production stack trace, so it is
            worth surfacing — quietly — for anyone reporting the problem. */}
        {error.digest && (
          <p className="font-mono text-[11px] text-text-tertiary">
            ref {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
