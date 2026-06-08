import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[88px] w-full rounded-xl border border-border bg-background px-4 py-3 text-[16px] font-medium text-foreground caret-accent leading-relaxed",
          "placeholder:font-normal placeholder:text-text-tertiary",
          "transition-[border-color,box-shadow,background-color] duration-base ease-out",
          "hover:border-border-strong",
          "focus:outline-none focus:border-accent focus:shadow-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
