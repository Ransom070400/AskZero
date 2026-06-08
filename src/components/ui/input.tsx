import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-background px-4 text-[16px] font-medium text-foreground caret-accent",
          "placeholder:font-normal placeholder:text-text-tertiary",
          "transition-[border-color,box-shadow,background-color] duration-base ease-out",
          "hover:border-border-strong",
          "focus:outline-none focus:border-accent focus:shadow-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
