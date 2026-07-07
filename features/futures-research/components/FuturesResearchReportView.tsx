"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { approveFuturesResearchReportAction } from "@/features/futures-research/actions";
import type { FuturesResearchWorkspace } from "@/features/futures-research/types";
import { ROUTES } from "@/lib/routes";

function StatusGlassBadge({ label }: { label: string }) {
  return (
    <span
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
          {label}
        </span>
      </span>
    </span>
  );
}

function PreparingState() {
  return (
    <div className="pt-[15px]">
      <div className="mx-auto w-full max-w-[1057px]">
        <div className="flex flex-col">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            {ROADMAP_PHASE_LABELS.futuresResearch}
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink)]">
            Futures Research
          </h1>
          <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
            Your stakeholder interview report has been approved, and this
            source document is now being prepared by the AIQ STUDIO team. Once
            the futures research is ready, you&apos;ll be able to review and
            approve it here.
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
                <StatusGlassBadge label="In preparation" />
              </div>

              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
                  Futures research report in preparation
                </h2>
                <p className="mt-2 max-w-[700px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
                  AIQ STUDIO strategists are mapping market signals, future
                  scenarios, and competitive shifts for your brand. Once
                  uploaded, this source document will appear here for review
                  before it feeds the Brand Brain knowledge base. No action is
                  required from you at this stage.
                </p>
              </div>

              <div
                className="border-t pt-4"
                style={{ borderColor: "rgba(15,15,20,0.08)" }}
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={ROUTES.brainRoadmapStakeholderInterviews}>
                      Review Interviews Report
                    </Link>
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

function ReviewReadyCard() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusGlassBadge label="Ready for review" />
      </div>

      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
          Futures research report ready for review
        </h2>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "rgba(15,15,20,0.08)" }}
      />
    </div>
  );
}

function EmptyCommentsHint() {
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-6 text-center shadow-xs">
      <p className="text-[12px] font-medium leading-4 text-muted-foreground">
        Select text in the report to attach a comment, or write a general
        comment in the panel.
      </p>
    </div>
  );
}

export function FuturesResearchReportView({
  workspace,
  currentUserId,
}: {
  workspace: FuturesResearchWorkspace;
  currentUserId: string;
}) {
  const { report, markdown, comments, canReview, signedUrl, inlineUrl } =
    workspace;
  const status = report?.status ?? "PENDING_UPLOAD";
  const canDecide =
    canReview && (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");
  const downloadUrl = signedUrl ?? inlineUrl;

  return (
    <ReviewSurface
      canComment={canReview}
      comments={comments}
      currentUserId={currentUserId}
      description="A forward-looking analysis prepared by AIQ STUDIO strategists from market, industry, and competitor research. Once approved, it becomes a source document for the Brand Brain knowledge base. Read it through, comment on anything unclear, and approve it once it's accurate."
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveFuturesResearchReportAction,
      }}
      emptyState={<PreparingState />}
      eyebrow={ROADMAP_PHASE_LABELS.futuresResearch}
      eyebrowVariant="roadmap"
      contentCardClassName="shadow-none"
      contentCardStyle={{
        background:
          "linear-gradient(180deg, rgba(226,232,240,0.78) 0%, rgba(248,250,252,0.98) 100%)",
        borderColor: "rgba(15,15,20,0.08)",
      }}
      contentFrameClassName="border-white/80 bg-white/95 shadow-none"
      emptyCommentsState={<EmptyCommentsHint />}
      enablePdfSearch
      introCard={downloadUrl ? <ReviewReadyCard /> : null}
      inlineUrl={inlineUrl}
      markdown={markdown}
      signedUrl={signedUrl}
      showSelectionHint={false}
      showHeaderDownload={false}
      subjectId={report?.id ?? ""}
      subjectType="FUTURES_RESEARCH"
      title="Futures Research"
    />
  );
}
