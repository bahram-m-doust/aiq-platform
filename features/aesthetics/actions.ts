"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { logServerError } from "@/lib/logging/server";
import {
  type AestheticsKind,
  aestheticsKindRoutes,
  ROUTES,
} from "@/lib/routes";
import { validateSecureUpload } from "@/lib/security/file-upload";
import { getAestheticsRowByBrandAndKind } from "@/features/aesthetics/queries";
import { isAestheticsPdf } from "@/features/aesthetics/schema";
import {
  uploadAestheticsDeliverable,
  setAestheticsStatus,
} from "@/features/aesthetics/services";
import type { AestheticsActionState } from "@/features/aesthetics/types";
import { detachDeliverableFile } from "@/features/review-deliverables/detach-service";
import { requireDeliverableReviewer } from "@/features/review-deliverables/reviewer";

const VALID_KINDS: AestheticsKind[] = [
  "VISUAL_DIRECTION",
  "COLOR_TYPE_SYSTEM",
  "ASSET_LIBRARY",
];

function isAestheticsKind(value: string): value is AestheticsKind {
  return (VALID_KINDS as string[]).includes(value);
}

function revalidateAestheticsPaths(kind: AestheticsKind) {
  revalidatePath(aestheticsKindRoutes[kind]);
  revalidatePath(ROUTES.brainRoadmap);
  revalidatePath(ROUTES.brain);
}

export async function uploadAestheticsDeliverableAction(
  _prevState: AestheticsActionState,
  formData: FormData,
): Promise<AestheticsActionState> {
  const { profile } = await requireUserProfile("/admin");

  if (!canViewAdminModulesRole(profile.global_role)) {
    return { status: "error", message: "You cannot upload this deliverable." };
  }

  const brandId = String(formData.get("brand_id") ?? "").trim();
  const kindValue = String(formData.get("kind") ?? "").trim();
  const file = formData.get("file");

  if (!brandId) {
    return { status: "error", message: "Select a brand." };
  }
  if (!isAestheticsKind(kindValue)) {
    return { status: "error", message: "Select a deliverable type." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: "Choose a PDF file to upload." };
  }
  if (!isAestheticsPdf(file)) {
    return {
      status: "error",
      message: "The file must be a valid PDF up to 10 MB.",
    };
  }
  const validation = await validateSecureUpload({
    file,
    allowedKinds: ["PDF"],
  });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  try {
    await uploadAestheticsDeliverable({
      brandId,
      profileId: profile.id,
      kind: kindValue,
      file,
    });
  } catch (error) {
    logServerError({
      label: "[aesthetics] deliverable upload failed",
      error,
      metadata: { profileId: profile.id, brandId, kind: kindValue },
    });
    return {
      status: "error",
      message: "Could not upload the file. Please try again.",
    };
  }

  revalidateAestheticsPaths(kindValue);
  revalidatePath("/admin/aesthetics");

  return { status: "success", message: "File sent for client review." };
}

export async function deleteAestheticsDeliverableAction({
  brandId,
  kind,
}: {
  brandId: string;
  kind: AestheticsKind;
}): Promise<{ ok: boolean; message?: string }> {
  const { profile } = await requireUserProfile("/admin/aesthetics");
  if (!canViewAdminModulesRole(profile.global_role)) {
    return { ok: false, message: "You cannot delete this deliverable." };
  }
  if (!brandId || !isAestheticsKind(kind)) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    await detachDeliverableFile({
      table: "aesthetics_deliverables",
      match: { brand_id: brandId, kind },
    });
  } catch (error) {
    logServerError({
      label: "[aesthetics] deliverable delete failed",
      error,
      metadata: { brandId, kind },
    });
    return { ok: false, message: "Could not delete the file. Try again." };
  }

  revalidateAestheticsPaths(kind);
  revalidatePath("/admin/aesthetics");
  return { ok: true };
}

export async function approveAestheticsDeliverableAction({
  kind,
}: {
  kind: AestheticsKind;
}): Promise<{ ok: boolean; message?: string }> {
  const clientPath = aestheticsKindRoutes[kind];

  const reviewer = await requireDeliverableReviewer(clientPath);
  if (!reviewer) {
    return { ok: false, message: "You cannot review this deliverable." };
  }

  const row = await getAestheticsRowByBrandAndKind(reviewer.brandId, kind);
  if (!row || !row.file_id) {
    return { ok: false, message: "There is no file to review yet." };
  }

  try {
    await setAestheticsStatus({
      brandId: reviewer.brandId,
      kind,
      profileId: reviewer.profileId,
      status: "APPROVED",
    });
  } catch (error) {
    logServerError({
      label: "[aesthetics] approve failed",
      error,
      metadata: { brandId: reviewer.brandId, kind },
    });
    return { ok: false, message: "Could not record the decision. Try again." };
  }

  revalidateAestheticsPaths(kind);
  return { ok: true };
}
