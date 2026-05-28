import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { ChangeRequestCreateForm } from "@/features/change-requests/components/ChangeRequestCreateForm";
import { getChangeRequestCreateOptions } from "@/features/change-requests/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Change Requests | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardChangeRequestsPage() {
  const { profile } = await requireUserProfile("/dashboard/change-requests");
  const options = await getChangeRequestCreateOptions(profile.id);

  if (!options) {
    redirect("/dashboard");
  }

  return (
    <PageShell
      eyebrow="Change Requests"
      subtitle="Request a reviewed correction to your locked intake or approved modules."
      title="Request a Correction"
    >
      <ChangeRequestCreateForm options={options} />
    </PageShell>
  );
}
