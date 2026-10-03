"use client";

import { useEffect, useState } from "react";

// Press "?" (outside a text field) to see the keyboard shortcuts.
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?") {
        const el = document.activeElement as HTMLElement | null;
        const typing =
          el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const mod = isMac ? "⌘" : "Ctrl";
  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: [mod, "K"], label: "Open command palette" },
    { keys: [mod, "Shift", "O"], label: "New chat" },
    { keys: [mod, "/"], label: "Focus the message box" },
    { keys: ["/"], label: "Slash commands (in the message box)" },
    { keys: ["Enter"], label: "Send message" },
    { keys: ["Shift", "Enter"], label: "New line" },
    { keys: ["?"], label: "Show this help" },
    { keys: ["Esc"], label: "Close menus & dialogs" },
  ];

  return (
    <div className="fixed inset-0 z-command-help flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
          <h2 className="text-md font-semibold text-foreground">
            Keyboard shortcuts
          </h2>
          <kbd className="rounded border border-border/70 px-1.5 py-0.5 text-2xs text-text-tertiary">
            esc
          </kbd>
        </div>
        <div className="divide-y divide-border/50 px-5 py-2">
          {shortcuts.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <span className="text-sm text-text-secondary">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-[22px] rounded-md border border-border/70 bg-surface px-1.5 py-0.5 text-center text-2xs font-medium text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
