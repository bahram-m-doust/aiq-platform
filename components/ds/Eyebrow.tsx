import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]",
        className,
      )}
    >
      <span
        className="inline-block h-px w-[18px]"
        style={{ background: "var(--bv-line-2)" }}
      />
      {children}
    </span>
  );
}
