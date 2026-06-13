import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DeliverablePendingState } from "@/components/review/DeliverablePendingState";
import { ReviewSurface } from "@/components/review/ReviewSurface";
import { requireUserProfile } from "@/features/auth/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { isReviewSubjectType } from "@/features/review-comments/schema";
import { getAdminReviewSurface } from "@/features/review-content/admin-surface";

export const metadata: Metadata = {
  title: "Internal Review | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function NotAvailable({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-[860px] px-6 py-10">
      <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          This review isn&apos;t available.
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

// Internal staff review surface — reached from an INTERNAL_TEAM notification
// deep link. Renders the same unified viewer as the client, with commenting
// enabled (replies notify the client) but no approve/request-changes (that is
// the client's decision). Brand + subject come from the verified query params.
export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/admin/review");
  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/home");
  }

  const sp = await searchParams;
  const subjectType = typeof sp.subjectType === "string" ? sp.subjectType : "";
  const subjectId = typeof sp.subjectId === "string" ? sp.subjectId : "";
  const brandId = typeof sp.brandId === "string" ? sp.brandId : "";

  if (!isReviewSubjectType(subjectType) || !subjectId || !brandId) {
    return <NotAvailable message="The review link is incomplete." />;
  }

  const surface = await getAdminReviewSurface({
    subjectType,
    subjectId,
    brandId,
    profile,
  });
  if (!surface) {
    return (
      <NotAvailable message="The deliverable was not found for this brand, or you don't have access to it." />
    );
  }

  return (
    <ReviewSurface
      canComment
      comments={surface.comments}
      contextBrandId={brandId}
      currentUserId={profile.id}
      emptyState={
        <main className="mx-auto w-full max-w-[860px] px-6 py-10">
          <DeliverablePendingState
            body="No file has been uploaded for this deliverable yet."
            eyebrow={surface.eyebrow}
            headline="Nothing to review yet"
            title={surface.title}
          />
        </main>
      }
      eyebrow={
        surface.brandName
          ? `${surface.eyebrow} · ${surface.brandName}`
          : surface.eyebrow
      }
      inlineUrl={surface.inlineUrl}
      markdown={surface.markdown}
      signedUrl={surface.signedUrl}
      subjectId={subjectId}
      subjectType={subjectType}
      title={surface.title}
    />
  );
}
