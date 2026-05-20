import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangeRequestCreateForm } from "@/features/change-requests/components/ChangeRequestCreateForm";
import { getChangeRequestCreateOptions } from "@/features/change-requests/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Change Requests | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardChangeRequestsPage() {
  const { user, profile } = await requireUserProfile(
    "/dashboard/change-requests",
  );
  const options = await getChangeRequestCreateOptions(profile.id);

  if (!options) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Change Requests
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Request a Reviewed Correction
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>
        <ChangeRequestCreateForm options={options} />
      </section>
    </main>
  );
}
