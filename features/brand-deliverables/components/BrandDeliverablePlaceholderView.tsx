import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export function BrandDeliverablePlaceholderView({
  eyebrow,
  title,
  description,
  headline,
  body,
}: {
  eyebrow: string;
  title: string;
  description: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="pt-[15px]">
      <div className="mx-auto w-full max-w-[1057px]">
        <div className="flex flex-col">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            {eyebrow}
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink)]">
            {title}
          </h1>
          <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
            {description}
          </p>

          <div
            className="mt-8 rounded-[12px] border px-6 py-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(226,232,240,0.78) 0%, rgba(248,250,252,0.98) 100%)",
              borderColor: "rgba(15,15,20,0.08)",
            }}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-8 items-center justify-center overflow-hidden rounded-full border px-3 backdrop-blur-md"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(226,232,240,0.58) 100%)",
                    borderColor: "rgba(255,255,255,0.7)",
                    color: "rgb(100,116,139)",
                  }}
                >
                  <span className="absolute inset-0 bg-white/30" />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    <FileTextIcon className="block size-4 shrink-0" />
                    <span className="whitespace-nowrap font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-[rgb(100,116,139)]">
                      In preparation
                    </span>
                  </span>
                </span>
              </div>

              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
                  {headline}
                </h2>
                <p className="mt-2 max-w-[700px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
                  {body}
                </p>
              </div>

              <div
                className="border-t pt-4"
                style={{ borderColor: "rgba(15,15,20,0.08)" }}
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={ROUTES.home}>Back Home</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
