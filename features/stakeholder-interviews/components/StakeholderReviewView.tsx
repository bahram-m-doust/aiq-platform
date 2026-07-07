"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { ROADMAP_PHASE_LABELS } from "@/features/app/roadmap-phase-labels";
import { approveStakeholderReportAction } from "@/features/stakeholder-interviews/actions";
import type { StakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/types";
import { ROUTES } from "@/lib/routes";

function PreparingState() {
  return (
    <div className="pt-[15px]">
      <div className="mx-auto w-full max-w-[1057px]">
        <div className="flex flex-col">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            {ROADMAP_PHASE_LABELS.stakeholderInterviews}
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-[var(--bv-ink)]">
            Stakeholder Interviews Report
          </h1>
          <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
            Your questionnaire has been approved, and this phase is now being
            prepared by the AIQ STUDIO team. Once the stakeholder interview
            report is ready, you&apos;ll be able to review and approve it here.
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
                  className="relative inline-flex h-8 items-center justify-center overflow-hidden rounded-full border px-3 backdrop-blur-md"
                  aria-hidden="true"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(226,232,240,0.58) 100%)",
                    borderColor: "rgba(255,255,255,0.7)",
                    color: "rgb(100,116,139)",
                  }}
                >
                  <span
                    className="absolute inset-0 bg-white/30"
                  />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    <FileTextIcon className="block size-4 shrink-0" />
                    <span className="font-mono text-[9px] leading-none uppercase tracking-[0.12em] text-[rgb(100,116,139)] whitespace-nowrap">
                      In preparation
                    </span>
                  </span>
                </span>
              </div>

              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
                  Stakeholder interview report in preparation
                </h2>
                <p className="mt-2 max-w-[700px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
                  AIQ STUDIO is reviewing stakeholder input and preparing the
                  report for your approval. Once uploaded, the PDF will appear
                  here for review, and you will be notified by email and
                  in-app notification. No action is required from you at this
                  stage.
                </p>
              </div>

              <div className="border-t pt-4" style={{ borderColor: "rgba(15,15,20,0.08)" }}>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={ROUTES.questionnaire}>Review Questionnaire</Link>
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
            <span className="font-mono text-[9px] leading-none uppercase tracking-[0.12em] text-[rgb(100,116,139)] whitespace-nowrap">
              Ready for review
            </span>
          </span>
        </span>
      </div>

      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
          Stakeholder interview report ready for review
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

export function StakeholderReviewView({
  workspace,
  currentUserId,
}: {
  workspace: StakeholderInterviewWorkspace;
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
      description="This report summarizes stakeholder interviews conducted by the AIQ STUDIO team during brand research. Once approved, it becomes a source document for the Brand Brain knowledge base. Read it through, comment on anything unclear, and approve it once it's accurate."
      decision={{
        canDecide,
        isApproved: status === "APPROVED",
        onApprove: approveStakeholderReportAction,
      }}
      emptyState={<PreparingState />}
      eyebrow={ROADMAP_PHASE_LABELS.stakeholderInterviews}
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
      subjectType="STAKEHOLDER_INTERVIEWS"
      title="Stakeholder Interviews Report"
    />
  );
}
