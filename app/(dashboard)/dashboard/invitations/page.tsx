import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { SpecialistInvitationForm } from "@/features/invitations/components/SpecialistInvitationForm";
import { getSpecialistInvitationContext } from "@/features/invitations/queries";

export const metadata: Metadata = {
  title: "Invite Specialist | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardInvitationsPage() {
  const { user, profile } = await requireUserProfile("/dashboard/invitations");
  const context = await getSpecialistInvitationContext(profile.id);

  if (!context) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Team Invitation
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Invite a Brand Specialist
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>
        <SpecialistInvitationForm context={context} />
      </section>
    </main>
  );
}
