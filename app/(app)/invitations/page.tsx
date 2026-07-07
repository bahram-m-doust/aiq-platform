import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ds/PageShell";
import { requireUserProfile } from "@/features/auth/queries";
import { SpecialistInvitationForm } from "@/features/invitations/components/SpecialistInvitationForm";
import { getSpecialistInvitationContext } from "@/features/invitations/queries";

export const metadata: Metadata = {
  title: "Invite Specialist | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const { profile } = await requireUserProfile("/invitations");
  const context = await getSpecialistInvitationContext(profile.id);

  if (!context) {
    redirect("/");
  }

  return (
    <PageShell
      eyebrow="Team Invitation"
      subtitle={
        <>
          <span className="block">
            Send a one-time invitation link to a Brand Specialist.
          </span>
          <span className="block">Links expire after first use.</span>
        </>
      }
      title="Invite a Specialist"
    >
      <SpecialistInvitationForm context={context} />
    </PageShell>
  );
}
