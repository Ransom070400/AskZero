"use client";

import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message AskZero..."
        className="min-h-[44px] md:min-h-[48px] resize-none rounded-2xl border-border-strong bg-elevated pr-12 text-[16px] md:text-sm placeholder:text-text-tertiary focus-visible:ring-accent/20 py-3 px-4"
        rows={1}
        disabled={disabled}
      />
      <button
        className="absolute bottom-2.5 right-2.5 flex h-8 w-8 md:h-7 md:w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-150 hover:bg-accent-hover disabled:opacity-30 active:scale-90"
        disabled={!value.trim() || disabled}
        onClick={onSend}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}
