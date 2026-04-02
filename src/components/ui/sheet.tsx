"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <div>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ open?: boolean; onOpenChange?: (open: boolean) => void }>, {
            open,
            onOpenChange,
          });
        }
        return child;
      })}
    </div>
  );
}

function SheetTrigger({
  children,
  asChild,
  onOpenChange,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const handleClick = () => onOpenChange?.(true);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick} type="button">
      {children}
    </button>
  );
}

function SheetContent({
  children,
  className,
  side = "right",
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  className?: string;
  side?: "left" | "right";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/80"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-background shadow-lg transition-transform",
          side === "left" ? "left-0" : "right-0",
          className
        )}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => onOpenChange?.(false)}
          type="button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </>
  );
}

export { Sheet, SheetTrigger, SheetContent };
