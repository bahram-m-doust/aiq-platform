import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { requireUserProfile } from "@/features/auth/queries";
import { SpecialistInvitationForm } from "@/features/invitations/components/SpecialistInvitationForm";
import { getSpecialistInvitationContext } from "@/features/invitations/queries";

export const metadata: Metadata = {
  title: "Invite Specialist | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardInvitationsPage() {
  const { profile } = await requireUserProfile("/dashboard/invitations");
  const context = await getSpecialistInvitationContext(profile.id);

  if (!context) {
    redirect("/dashboard");
  }

  return (
    <PageShell
      eyebrow="Team Invitation"
      subtitle="Send a one-time invitation link to a Brand Specialist. Links expire after first use."
      title="Invite a Specialist"
    >
      <SpecialistInvitationForm context={context} />
    </PageShell>
  );
}
