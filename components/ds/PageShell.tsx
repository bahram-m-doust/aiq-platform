import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ds/Eyebrow";

export function PageShell({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  maxWidth = "5xl",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  className?: string;
}) {
  const maxWidthClass = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }[maxWidth];

  return (
    <main
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <section
        className={cn("mx-auto w-full space-y-6", maxWidthClass, className)}
        style={{ animation: "ds-fade-in 600ms var(--bv-ease)" }}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className="ds-h1">{title}</h1>
            {subtitle ? <p className="ds-body max-w-xl">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </section>
    </main>
  );
}
