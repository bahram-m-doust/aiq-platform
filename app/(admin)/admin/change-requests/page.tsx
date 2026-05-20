import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminChangeRequestsList } from "@/features/change-requests/components/AdminChangeRequestsList";
import { canReviewChangeRequestRole } from "@/features/change-requests/schema";
import { getAdminChangeRequests } from "@/features/change-requests/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Change Request Review | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminChangeRequestsPage() {
  const { user, profile } = await requireUserProfile("/admin/change-requests");

  if (!canReviewChangeRequestRole(profile.global_role)) {
    redirect("/dashboard");
  }

  const requests = await getAdminChangeRequests();
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Admin review
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Change Requests
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>
        <AdminChangeRequestsList requests={requests} />
      </section>
    </main>
  );
}
