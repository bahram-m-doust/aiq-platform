import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { RagSyncPanel } from "@/features/rag/components/RagSyncPanel";
import {
  getRagSyncDashboard,
} from "@/features/rag/queries";
import { canSyncRagRole, canViewRagApprovalQueueRole } from "@/features/rag/schema";

export const metadata: Metadata = {
  title: "RAG Approval Queue | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminRagApprovalPage() {
  const { user, profile } = await requireUserProfile("/admin/rag");

  if (!canViewRagApprovalQueueRole(profile.global_role)) {
    redirect("/");
  }

  const syncGroups = canSyncRagRole(profile.global_role)
    ? await getRagSyncDashboard()
    : [];
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Internal RAG approval
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            RAG Approval Queue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {profile.global_role}
          </p>
        </div>

        {canSyncRagRole(profile.global_role) ? (
          <RagSyncPanel groups={syncGroups} />
        ) : null}

        
      </section>
    </main>
  );
}
