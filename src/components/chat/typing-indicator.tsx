"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2" aria-label="Assistant is typing">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-tertiary" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-tertiary [animation-delay:160ms]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-tertiary [animation-delay:320ms]" />
    </div>
  );
}
