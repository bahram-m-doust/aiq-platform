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
        AIQ STUDIO strategists have mapped the trends and future scenarios
        shaping where your brand can go. Review this source document, leave
        comments anywhere on it, and approve it when it is ready for the Brand
        Brain knowledge base.
      </p>
    </div>
  );
}
