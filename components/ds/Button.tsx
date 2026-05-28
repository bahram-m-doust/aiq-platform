"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type DSButtonVariant = "brand" | "outline" | "ghost";
type DSButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<DSButtonVariant, string> = {
  brand:
    "text-[var(--bv-brand-ink)] shadow-[0_8px_24px_-10px_var(--bv-brand-tint-32),0_0_0_1px_var(--bv-brand-mid)] hover:shadow-[0_12px_32px_-10px_var(--bv-brand-tint-32),0_0_0_1px_var(--bv-brand-mid)] hover:scale-[1.01] active:scale-[0.99]",
  outline:
    "border bg-white text-[var(--bv-ink-2)] hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]",
  ghost:
    "text-[var(--bv-ink-3)] hover:bg-[var(--bv-panel)] hover:text-[var(--bv-ink)]",
};

const sizeStyles: Record<DSButtonSize, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-10 px-4 text-[13px]",
  lg: "h-12 px-6 text-[14px]",
};

export const DSButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: DSButtonVariant;
    size?: DSButtonSize;
    asChild?: boolean;
  }
>(function DSButton(
  { variant = "brand", size = "md", className, style, asChild = false, ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      ref={ref as React.Ref<HTMLButtonElement>}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      style={
        variant === "brand"
          ? {
              background:
                "linear-gradient(135deg, var(--bv-brand) 0%, var(--bv-brand-mid) 60%, var(--bv-brand-deep) 100%)",
              ...style,
            }
          : variant === "outline"
            ? { borderColor: "var(--bv-line)", ...style }
            : style
      }
      {...props}
    />
  );
});
