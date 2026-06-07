import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";

import { requireUserProfile } from "@/features/auth/queries";
import { PdfAnnotator } from "@/features/stakeholder-interviews/components/PdfAnnotator";
import { getStakeholderInterviewWorkspace } from "@/features/stakeholder-interviews/queries";

export const metadata: Metadata = {
  title: "Stakeholder Interviews | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function StakeholderInterviewsPage() {
  const { profile } = await requireUserProfile(
    "/dashboard/brain/roadmap/stakeholder-interviews",
  );
  const workspace = await getStakeholderInterviewWorkspace({
    profileId: profile.id,
  });

  if (!workspace.access) {
    redirect("/dashboard/brain/roadmap");
  }

  const status = workspace.report?.status ?? "PENDING_UPLOAD";
  const hasPdf = Boolean(workspace.report?.file && workspace.signedUrl);
  const isApproved = status === "APPROVED";
  const editable =
    workspace.canReview &&
    (status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED");

  return (
    <div
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-8"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div className="w-full">
        <div className="mb-6 md:hidden">
          {/* Back pill only on mobile — desktop relies on the header breadcrumb */}
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-[var(--bv-line)] bg-white px-3.5 py-2 text-[13px] text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:bg-[var(--bv-card-soft)] hover:text-[var(--bv-ink)]"
            href="/dashboard/brain/roadmap"
          >
            <ArrowLeftIcon className="size-3.5" />
            Build roadmap
          </Link>
        </div>

        <div className="mb-7">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            Brand Research · Step 02
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            Stakeholder Interviews
          </h1>
          <p className="mt-2 max-w-[680px] text-sm leading-relaxed text-[var(--bv-ink-3)]">
            The Bextudio team has analysed the interviews with your brand team.
            Review the report below, leave comments anywhere on the document,
            and approve it when you are happy — that unlocks Futures Research.
          </p>
        </div>

        {isApproved ? (
          <div
            className="mb-5 flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-[13px]"
            style={{
              borderColor: "rgba(43,199,138,0.28)",
              background: "rgba(43,199,138,0.10)",
              color: "#157a52",
            }}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <CheckCircleIcon className="size-4" />
              Stakeholder interviews approved.
            </span>
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
              href="/dashboard/brain/roadmap"
            >
              Next: Futures Research
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        ) : null}

        {hasPdf && workspace.report && workspace.signedUrl ? (
          <PdfAnnotator
            canApprove={workspace.canReview}
            canResolve={workspace.canReview}
            currentUserId={profile.id}
            editable={editable}
            initialAnnotations={workspace.annotations}
            isApproved={isApproved}
            reportId={workspace.report.id}
            signedUrl={workspace.signedUrl}
          />
        ) : (
          <div
            className="rounded-xl border border-dashed px-6 py-12 text-center"
            style={{ borderColor: "var(--bv-line-2)" }}
          >
            <p className="text-sm font-medium text-[var(--bv-ink-2)]">
              Your interview analysis is being prepared.
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--bv-ink-3)]">
              The Bextudio team is finalising the report. You will be able to
              review and approve it here once it is uploaded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
