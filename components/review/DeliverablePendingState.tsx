import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ds/Eyebrow";

// The shared "deliverable not ready yet" empty state, styled with the design
// system's typography. Every review surface renders this (inside its own page
// container) instead of repeating the markup, so the empty state stays
// consistent and changes in one place.
export function DeliverablePendingState({
  eyebrow,
  title,
  headline,
  body,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  headline: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="ds-h2">{title}</h2>
      <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
        <p className="ds-h3">{headline}</p>
        <p className="ds-caption mt-1.5">{body}</p>
      </div>
    </div>
  );
}
