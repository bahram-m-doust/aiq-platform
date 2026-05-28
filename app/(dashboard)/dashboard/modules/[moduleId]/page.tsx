import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { PageShell } from "@/components/ds/PageShell";
import { requireUserProfile } from "@/features/auth/queries";
import { ClientReviewPanel } from "@/features/modules/components/ClientReviewPanel";
import { ModuleReviewTimeline } from "@/features/modules/components/ModuleReviewTimeline";
import { ModuleStatusBadge } from "@/features/modules/components/ModuleStatusBadge";
import { getClientModuleReviewPageData } from "@/features/modules/services";

export const metadata: Metadata = {
  title: "Module Review | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const { profile } = await requireUserProfile(
    `/dashboard/modules/${moduleId}`,
  );
  const data = await getClientModuleReviewPageData({
    moduleId,
    profile,
  });

  if (!data) {
    redirect("/dashboard/modules");
  }

  return (
    <PageShell
      eyebrow="Strategy Review"
      maxWidth="6xl"
      subtitle={`${data.module.moduleTypeLabel} · ${data.access.brandName}`}
      title={data.module.title}
    >
      <DSCard>
        <DSCardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="ds-h2">{data.module.moduleTypeLabel}</h2>
              <p className="ds-caption mt-1">
                Client approval records the final review decision. It does not
                trigger Brand Brain sync or RAG approval.
              </p>
            </div>
            <ModuleStatusBadge status={data.module.status} />
          </div>
        </DSCardHeader>
        <DSCardBody>
          <ClientReviewPanel data={data} />
        </DSCardBody>
      </DSCard>

      <ModuleReviewTimeline reviews={data.reviews} />
    </PageShell>
  );
}
