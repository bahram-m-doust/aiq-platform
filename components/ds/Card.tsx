import { cn } from "@/lib/utils";

export type DSCardTone = "default" | "soft" | "panel";

const toneStyles: Record<DSCardTone, React.CSSProperties> = {
  default: {
    background: "var(--bv-card)",
    borderColor: "var(--bv-line)",
    boxShadow: "var(--bv-shadow-card)",
  },
  soft: {
    background: "var(--bv-card-soft)",
    borderColor: "var(--bv-line)",
    boxShadow: "var(--bv-shadow-card)",
  },
  panel: {
    background: "var(--bv-panel)",
    borderColor: "var(--bv-panel-edge)",
    boxShadow: "var(--bv-shadow-panel)",
  },
};

export function DSCard({
  children,
  tone = "default",
  hover = false,
  className,
  style,
  ...rest
}: {
  children: React.ReactNode;
  tone?: DSCardTone;
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border transition-all duration-300",
        hover && "hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
      style={{ ...toneStyles[tone], ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DSCardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5 pb-3", className)}>{children}</div>;
}

export function DSCardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function DSCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 px-5 py-4 border-t border-dashed", className)}
      style={{ borderColor: "var(--bv-line-dashed)" }}
    >
      {children}
    </div>
  );
}
