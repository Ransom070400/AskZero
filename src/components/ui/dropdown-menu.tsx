"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
});

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick} type="button">
      {children}
    </button>
  );
}

function DropdownMenuContent({
  children,
  className,
  align = "start",
  side = "bottom",
  forceMount,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
  // "top" opens the menu upward (above the trigger) — use it for triggers
  // near the bottom of the screen (e.g. the chat composer) so the menu
  // doesn't open off the bottom edge.
  side?: "top" | "bottom";
  forceMount?: boolean;
}) {
  const { open } = React.useContext(DropdownMenuContext);

  if (!open && !forceMount) return null;
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 min-w-[10rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  return (
    <button
      className={cn(
        "relative flex w-full select-none items-center rounded-lg px-2.5 py-2 text-[13px] font-medium text-foreground outline-none transition-colors duration-fast ease-out hover:bg-elevated focus:bg-elevated",
        className
      )}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1.5 my-1 h-px bg-border/60", className)} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
