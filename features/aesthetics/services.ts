import "server-only";

import { setAestheticsDeliverableStatus } from "@/features/review-deliverables/mutation-service";
import { uploadReviewDeliverable } from "@/features/review-deliverables/upload-service";
import { createNotification } from "@/features/notifications/mutation-service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AestheticsKind } from "@/lib/routes";

export async function uploadAestheticsDeliverable({
  brandId,
  profileId,
  kind,
  file,
}: {
  brandId: string;
  profileId: string;
  kind: AestheticsKind;
  file: File;
}): Promise<void> {
  await uploadReviewDeliverable({
    workflow: kind,
    brandId,
    profileId,
    file,
    mimeType: "application/pdf",
  });
}

export async function setAestheticsStatus({
  brandId,
  kind,
  profileId,
  status,
}: {
  brandId: string;
  kind: AestheticsKind;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  const { fileId } = await setAestheticsDeliverableStatus({ brandId, kind, profileId, status });

  if (status === "APPROVED") {
    // Promote the deliverable's PDF into the RAG knowledge base so the Brand
    // Brain can reference it during generation. Fire-and-forget — a failure
    // here must never roll back the client's approval decision.
    if (fileId) {
      void Promise.resolve(
        createAdminClient().rpc("promote_document_to_rag", {
          p_file_id: fileId,
          p_actor_id: profileId,
        }),
      ).catch(() => {});
    }

    // Notify admin so they can track Phase 03 progress and schedule Brain Build.
    createNotification({
      brandId,
      audience: "ADMIN",
      type: "AESTHETICS_APPROVED",
      title: "Aesthetics deliverable approved",
      body: `A client approved the ${kind} aesthetics deliverable.`,
      linkPath: "/admin/aesthetics",
      subjectType: "aesthetics_deliverable",
      actorId: profileId,
    }).catch(() => {});
  }
}
