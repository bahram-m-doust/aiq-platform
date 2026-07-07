import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

export function StakeholderHeader({ status }: { status: string }) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
          {ROADMAP_PHASE_LABELS.stakeholderInterviews}
        </span>
        <DeliverableStatusBadge status={status} />
      </div>

      <h1 className="text-xl font-semibold leading-7 tracking-[-0.01em] text-foreground">
        Stakeholder Interviews Report
      </h1>

      <p className="max-w-[545px] text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
        The AIQ STUDIO team has analysed the interviews with your brand team.
        Review the report below, leave comments anywhere on the document, and
        approve it when you are happy — that unlocks Futures Research.
      </p>
    </div>
  );
}
