"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// How long the "uncompleted" warning collapses out before the "Review &
// submit" button slides in, and how long the success tooltip lingers before
// fading on its own. The swap is kept deliberately unhurried so the hand-off
// reads as a smooth transition rather than a flip.
const WARNING_EXIT_MS = 600;
const TOOLTIP_VISIBLE_MS = 5200;

type Phase = "warning" | "exiting" | "ready";

// Renders the bottom of the progress panel once the user has reached the
// "Review & submit" step. While questions remain it shows the `warning` box;
// the moment the last answer lands it collapses that box out and reveals the
// final "Review & submit" button, popping a success tooltip alongside it.
export function ReviewReadyReveal({
  complete,
  totalQuestions,
  reviewHref,
  showReadyAction = true,
  warning,
  panelOpen = true,
}: {
  complete: boolean;
  totalQuestions: number;
  reviewHref: string;
  showReadyAction?: boolean;
  warning: ReactNode;
  // The tooltip portals to <body>, so only auto-surface it while the panel is
  // actually open — otherwise it would float, unanchored, over a hidden panel.
  panelOpen?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(complete ? "ready" : "warning");
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // Last committed `complete`, so the swap only animates real transitions —
  // never an already-complete first mount (which would flash the warning).
  const prevCompleteRef = useRef(complete);

  // Drive the warning → button swap. Updates run on timers (never synchronously
  // in the effect body) so the CSS transition gets a frame to play and renders
  // don't cascade.
  useEffect(() => {
    const prev = prevCompleteRef.current;
    prevCompleteRef.current = complete;
    if (prev === complete) return;

    if (complete) {
      const collapse = setTimeout(() => setPhase("exiting"), 0);
      const reveal = setTimeout(() => setPhase("ready"), WARNING_EXIT_MS);
      return () => {
        clearTimeout(collapse);
        clearTimeout(reveal);
      };
    }

    // Dropped back below 100% (an answer was un-marked) — restore the warning.
    const restore = setTimeout(() => setPhase("warning"), 0);
    return () => clearTimeout(restore);
  }, [complete]);

  // Surface the success tooltip alongside the button, then let it fade. Kept in
  // timer callbacks for the same reason as the swap above.
  useEffect(() => {
    if (phase !== "ready" || !panelOpen) {
      const hide = setTimeout(() => setTooltipOpen(false), 0);
      return () => clearTimeout(hide);
    }
    const show = setTimeout(() => setTooltipOpen(true), 0);
    const fade = setTimeout(() => setTooltipOpen(false), TOOLTIP_VISIBLE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(fade);
    };
  }, [phase, panelOpen]);

  if (phase === "ready") {
    if (!showReadyAction) {
      return null;
    }

    return (
      <div className="border-t border-[var(--bv-line)] pt-4">
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 zoom-in-95 duration-500">
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>
              <Button asChild className="w-full" size="lg" variant="outline">
                <Link href={reviewHref}>
                  <CircleCheckIcon className="size-4" />
                  Review &amp; submit
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent
              className="max-w-[240px] leading-4"
              side="left"
              sideOffset={8}
              variant="success"
            >
              You&apos;ve answered all {totalQuestions} questions. Click here to
              review &amp; submit your Questionnaires.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  // `grid-template-rows: 1fr → 0fr` animates the warning's real height to zero
  // (smoother than max-height) while it fades, then the effect unmounts it.
  return (
    <div
      className="grid transition-[grid-template-rows,opacity]"
      style={{
        gridTemplateRows: phase === "exiting" ? "0fr" : "1fr",
        opacity: phase === "exiting" ? 0 : 1,
        transitionDuration: `${WARNING_EXIT_MS}ms`,
        transitionTimingFunction: "var(--bv-ease)",
      }}
    >
      <div className="overflow-hidden">{warning}</div>
    </div>
  );
}
