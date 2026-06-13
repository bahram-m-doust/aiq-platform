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

export default async function ChangeRequestsPage() {
  const { profile } = await requireUserProfile("/change-requests");
  const options = await getChangeRequestCreateOptions(profile.id);

  if (!options) {
    redirect("/home");
  }

  return (
    <PageShell
      eyebrow="Change Requests"
      subtitle="Request a reviewed correction to your locked questionnaire answers."
      title="Request a Correction"
    >
      <ChangeRequestCreateForm options={options} />
    </PageShell>
  );
}
