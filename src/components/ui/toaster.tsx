"use client";

import { useEffect, useState } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToasts, type ToastItem } from "@/lib/toast";

const DURATION = 3600;

const ICON = {
  success: <Check className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-error" />,
  info: <Info className="h-4 w-4 text-accent" />,
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DURATION);
    });
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-elevated px-3.5 py-2.5 shadow-lg",
            "animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out"
          )}
        >
          <span className="shrink-0">{ICON[t.variant]}</span>
          <span className="flex-1 text-[13px] text-foreground">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="press shrink-0 rounded-md p-0.5 text-text-tertiary hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
