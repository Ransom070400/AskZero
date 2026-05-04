import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: rounded-xl for substance, single motion vocabulary, calm focus halo, physical press
  "press focus-ring inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold tracking-tight select-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // Filled primary — soft elevation, brighten on hover, no color shift on press
        default:
          "bg-primary text-primary-foreground shadow-sm hover:brightness-110 hover:shadow-md",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:bg-surface hover:border-border-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-elevated",
        ghost:
          "text-foreground hover:bg-surface",
        link:
          "text-accent underline-offset-4 hover:underline px-0 h-auto",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110 hover:shadow-md",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <span className={cn(buttonVariants({ variant, size, className }))}>
          {props.children}
        </span>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
