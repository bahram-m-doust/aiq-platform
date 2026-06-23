import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ds/Eyebrow";

// The shared "deliverable not ready yet" empty state, styled with the design
// system's typography. Every review surface renders this (inside its own page
// container) instead of repeating the markup, so the empty state stays
// consistent and changes in one place.
export function DeliverablePendingState({
  eyebrow,
  eyebrowVariant = "default",
  title,
  description,
  headline,
  body,
  actions,
}: {
  eyebrow?: ReactNode;
  eyebrowVariant?: "default" | "roadmap";
  title: ReactNode;
  description?: string;
  headline: string;
  body: string;
  actions?: ReactNode;
}) {
  const isRoadmap = eyebrowVariant === "roadmap";

  return (
    <div className={isRoadmap ? "flex flex-col" : "flex flex-col gap-4"}>
      {eyebrow ? (
        isRoadmap ? (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            {eyebrow}
          </span>
        ) : (
          <Eyebrow>{eyebrow}</Eyebrow>
        )
      ) : null}
      <h2
        className={
          isRoadmap
            ? "mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink)]"
            : "ds-h2"
        }
      >
        {title}
      </h2>
      {description ? (
        <p
          className={
            isRoadmap
              ? "mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]"
              : "max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]"
          }
        >
          {description}
        </p>
      ) : null}
      <div
        className={
          isRoadmap
            ? "mt-4 rounded-[10px] border border-dashed border-border px-6 py-12 text-center"
            : "rounded-[10px] border border-dashed border-border px-6 py-12 text-center"
        }
      >
        <p className="ds-h3">{headline}</p>
        <p className="ds-caption mt-1.5">{body}</p>
        {actions ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
