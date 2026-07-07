import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DSCard, DSCardHeader } from "@/components/ds/Card";
import { PageShell } from "@/components/ds/PageShell";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Settings | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile } = await requireUserProfile("/settings");
  const summary = await getBrandAccessSummaryForProfile(profile.id);

  if (summary.status !== "ACTIVE_ACCESS") {
    redirect("/");
  }

  return (
    <PageShell
      eyebrow="Workspace"
      subtitle="Manage your workspace preferences."
      title="Settings"
    >
      <DSCard>
        <DSCardHeader>
          <h2 className="ds-h2">Coming soon</h2>
          <p className="ds-body mt-1">
            Settings are being designed. This space will hold your workspace
            and account preferences.
          </p>
        </DSCardHeader>
      </DSCard>
    </PageShell>
  );
}
