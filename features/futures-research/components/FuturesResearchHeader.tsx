import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

export function FuturesResearchHeader({ status }: { status: string }) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
          {ROADMAP_PHASE_LABELS.futuresResearch}
        </span>
        <DeliverableStatusBadge status={status} />
      </div>

      <h1 className="text-xl font-semibold leading-7 tracking-[-0.01em] text-foreground">
        Futures Research
      </h1>

      <p className="max-w-[545px] text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
        The Bextudio team has mapped the trends and future scenarios shaping
        where your brand can go. Review the futures research analysis below,
        leave comments anywhere on the document, and approve it when you are
        happy — that completes Brand Research.
      </p>
    </div>
  );
}
